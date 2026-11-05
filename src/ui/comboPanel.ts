import { initialTrialState, isAttemptInProgress, parseRecipe, stepTrial } from '../core/combo';
import type { ComboRecipe, TrialEvent, TrialState } from '../core/combo';
import { comboToRecipe } from '../core/characters';
import type { CharacterData } from '../core/characters';
import type { GameProfile } from '../core/profiles';
import { filterItems } from '../core/search';
import { createSearchInput } from './searchInput';
import { readFirst, recipesKeys } from '../core/storageKeys';
import type { FrameInput } from '../core/types';

export function describeDrop(
  e: Extract<TrialEvent, { type: 'drop' }>,
  recipe: ComboRecipe,
  inputBuffer = 0,
): string {
  switch (e.reason) {
    case 'early': {
      const w = recipe.steps[e.stepIndex]?.window;
      return `早い（あと ${(w?.min ?? 0) - inputBuffer - e.offset}F 遅く）`;
    }
    case 'late': {
      const w = recipe.steps[e.stepIndex]?.window;
      return `遅い（窓は ${w?.min}〜${w?.max}F）`;
    }
    case 'wrong':
      return '違う入力';
  }
}

/**
 * 成功した手の下に出す文。offset は前の手の基準からのフレーム数（最初の手は null）。
 * 窓より早い成功（先行入力）は、何 F 早かったかも出す。前の手が先行入力だと offset はマイナスになりうる
 */
export function describeHit(offset: number | null, window: { min: number; max: number } | null): string {
  if (offset === null) return 'OK';
  const shown = `${offset >= 0 ? '+' : ''}${offset}F`;
  const min = window?.min ?? 0;
  return offset < min ? `${shown}（先行 ${min - offset}F）` : shown;
}

function toJson(r: ComboRecipe): string {
  return JSON.stringify(
    {
      id: r.id,
      name: r.name,
      steps: r.steps.map((s, i) =>
        i === 0 || !s.window ? { input: s.text } : { input: s.text, window: [s.window.min, s.window.max] },
      ),
    },
    null,
    2,
  );
}

interface SavedData {
  recipes: ComboRecipe[];
  /** 読めなかった保存データ。消さずに、保存し直すときもそのまま書き戻す */
  unreadable: unknown[];
}

function loadSaved(profile: GameProfile, characterId: string | undefined, sampleIds: ReadonlySet<string>): SavedData {
  const empty: SavedData = { recipes: [], unreadable: [] };
  try {
    // 保存場所は recipesKeys のとおり（sf6 だけは、なければ前の版のキーも読む）
    const raw = readFirst((k) => localStorage.getItem(k), recipesKeys(profile.id, characterId).read);
    if (!raw) return empty;
    const list: unknown = JSON.parse(raw);
    if (!Array.isArray(list)) return empty;
    const out: SavedData = { recipes: [], unreadable: [] };
    for (const j of list) {
      const r = parseRecipe(j, profile);
      // サンプルと同じ id のものは一覧に2つ並ぶので、読めなかった扱いにする
      if (r.ok && !sampleIds.has(r.recipe.id)) out.recipes.push(r.recipe);
      else out.unreadable.push(j);
    }
    return out;
  } catch {
    return empty;
  }
}

function save(profile: GameProfile, characterId: string | undefined, recipes: readonly ComboRecipe[], unreadable: readonly unknown[]): boolean {
  try {
    const list = [...recipes.map((r) => JSON.parse(toJson(r)) as unknown), ...unreadable];
    localStorage.setItem(recipesKeys(profile.id, characterId).save, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

export interface ComboPanel {
  /** 1フレーム進める。コンボトライアルのタブが開いているときだけ呼ぶ */
  readonly step: (history: readonly FrameInput[], frame: number) => void;
  /** 最初の手からやり直す（タブを開いたときなど） */
  readonly reset: () => void;
  /** 挑戦の途中なら、最初の手に戻して理由を表示する（処理が止まったときなど）。途中でなければ何もしない */
  readonly invalidate: (reason: string) => void;
  /**
   * ゲーム（とキャラ）を切り替える。サンプル（キャラがあるときはキャラのコンボ）・表記のルール・保存したレシピを入れ替え、
   * 先頭のレシピを選び、回数を 0 にし、検索欄を空に戻す。保存したレシピの場所はキャラごと
   */
  readonly setProfile: (profile: GameProfile, character?: CharacterData) => void;
}

export function createComboPanel(
  root: HTMLElement,
  initialProfile: GameProfile,
  initialCharacter?: CharacterData,
): ComboPanel {
  const section = document.createElement('section');
  const title = document.createElement('h2');
  title.textContent = 'コンボトライアル';
  const search = createSearchInput('名前・表記で絞り込み（例: 623、2LK）');
  const list = document.createElement('div');
  list.className = 'command-list';
  const listNote = document.createElement('div');
  listNote.className = 'note';
  const stepsView = document.createElement('div');
  stepsView.className = 'combo-steps';
  const result = document.createElement('div');
  result.className = 'result';
  const stats = document.createElement('div');
  stats.className = 'note';
  const jsonArea = document.createElement('textarea');
  jsonArea.rows = 8;
  jsonArea.cols = 40;
  jsonArea.placeholder = 'レシピの JSON をここに貼り付け';
  const jsonButtons = document.createElement('div');
  const loadBtn = document.createElement('button');
  loadBtn.textContent = 'JSON を読み込む';
  const exportBtn = document.createElement('button');
  exportBtn.textContent = 'JSON に書き出す';
  jsonButtons.append(loadBtn, exportBtn);
  const message = document.createElement('div');
  message.className = 'note';
  section.append(title, search, list, listNote, stepsView, result, stats, jsonArea, jsonButtons, message);
  root.append(section);

  let profile = initialProfile;
  let characterId: string | undefined;
  let samples: readonly ComboRecipe[] = [];
  let saved: SavedData = { recipes: [], unreadable: [] };
  let recipes: ComboRecipe[] = [];
  let current = initialProfile.samples[0] as ComboRecipe;
  let state: TrialState = initialTrialState();
  let attempts = 0;
  let completes = 0;
  /** 手ごとの表示状態 */
  let marks: ({ kind: 'hit'; offset: number | null } | { kind: 'drop'; text: string } | null)[] = [];

  const idleText = () => '最初の手を入力してください';

  const renderSteps = () => {
    stepsView.replaceChildren(
      ...current.steps.map((s, i) => {
        const box = document.createElement('div');
        box.className = 'combo-step';
        const mark = marks[i];
        if (mark?.kind === 'hit') box.classList.add('hit');
        else if (mark?.kind === 'drop') box.classList.add('drop');
        else if (i === state.stepIndex) box.classList.add('next');
        const name = document.createElement('div');
        name.textContent = s.text;
        const sub = document.createElement('div');
        sub.className = 'note';
        if (mark?.kind === 'hit') sub.textContent = describeHit(mark.offset, s.window);
        else if (mark?.kind === 'drop') sub.textContent = mark.text;
        else sub.textContent = s.window ? `${s.window.min}〜${s.window.max}F` : '開始';
        box.append(name, sub);
        return box;
      }),
    );
  };

  const renderStats = () => {
    const rate = attempts === 0 ? '-' : `${Math.round((completes / attempts) * 100)}%`;
    stats.textContent = `挑戦 ${attempts} 回 / 完走 ${completes} 回 / 完走率 ${rate}`;
  };

  const reset = () => {
    state = initialTrialState();
    marks = [];
    result.className = 'result';
    result.textContent = idleText();
    renderSteps();
  };

  const renderList = () => {
    // 絞り込んで選んでいるレシピが一覧から消えても、選択はそのまま
    const shown = filterItems(recipes, search.value, (r) => [r.name, ...r.steps.map((s) => s.text)]);
    if (shown.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'note';
      empty.textContent = '当たるコンボがありません';
      list.replaceChildren(empty);
      return;
    }
    const buttons = shown.map((r) => {
      const b = document.createElement('button');
      b.textContent = r.name;
      b.classList.toggle('active', r === current);
      b.addEventListener('click', () => {
        current = r;
        attempts = 0;
        completes = 0;
        renderStats();
        reset();
        renderList();
        b.blur();
      });
      return b;
    });
    list.replaceChildren(...buttons);
  };

  loadBtn.addEventListener('click', () => {
    let json: unknown;
    try {
      json = JSON.parse(jsonArea.value);
    } catch (e) {
      message.className = 'note error';
      message.textContent = `JSON として読めません: ${e instanceof Error ? e.message : String(e)}`;
      return;
    }
    const r = parseRecipe(json, profile);
    if (!r.ok) {
      message.className = 'note error';
      message.textContent = r.error;
      return;
    }
    const at = recipes.findIndex((x) => x.id === r.recipe.id);
    if (at >= 0 && at < samples.length) {
      message.className = 'note error';
      message.textContent = `id「${r.recipe.id}」は内蔵サンプルと重なっています。別の id にしてください`;
      return;
    }
    if (at >= 0) recipes[at] = r.recipe;
    else recipes.push(r.recipe);
    current = r.recipe;
    attempts = 0;
    completes = 0;
    const ok = save(profile, characterId, recipes.slice(samples.length), saved.unreadable);
    message.className = 'note';
    message.textContent = ok
      ?`「${r.recipe.name}」を読み込みました`
      : `「${r.recipe.name}」を読み込みました（ブラウザへの保存はできませんでした）`;
    renderStats();
    reset();
    renderList();
  });

  exportBtn.addEventListener('click', () => {
    jsonArea.value = toJson(current);
    message.className = 'note';
    message.textContent = '選んでいるレシピを書き出しました';
  });

  search.addEventListener('input', renderList);

  /** ゲーム（とキャラ）に合わせて、レシピの一覧と保存データを読み直す */
  const applyProfile = (next: GameProfile, character?: CharacterData) => {
    profile = next;
    characterId = character?.id;
    // キャラのコンボは、読めないものがあれば出さない。一覧が 0 件にならないことは、データのテスト
    // （tests/characters.test.ts の「キャラを足すときの守り」）で確かめている
    samples = character
      ? character.combos.flatMap((c) => comboToRecipe(c, next) ?? [])
      : next.samples;
    listNote.textContent = character ? 'キャラのコンボの窓は仮の値です' : '';
    search.value = '';
    saved = loadSaved(next, characterId, new Set(samples.map((s) => s.id)));
    recipes = [...samples, ...saved.recipes];
    current = recipes[0] as ComboRecipe;
    attempts = 0;
    completes = 0;
    jsonArea.value = '';
    if (saved.unreadable.length > 0) {
      message.className = 'note error';
      message.textContent = `読めなかった保存レシピが ${saved.unreadable.length} 件あります（データは消さずに残しています）`;
    } else {
      message.className = 'note';
      message.textContent = '';
    }
    renderList();
    renderStats();
    reset();
  };
  applyProfile(initialProfile, initialCharacter);

  return {
    reset,
    setProfile: applyProfile,
    invalidate: (reason) => {
      if (!isAttemptInProgress(state)) return;
      reset();
      result.className = 'result ng';
      result.textContent = reason;
    },
    step: (history, frame) => {
      const out = stepTrial(state, current, history, frame, profile.inputBuffer);
      const prev = state;
      state = out.state;
      const e = out.event;
      if (!e) return;
      if (prev.stepIndex === 0) {
        // 新しい挑戦の開始
        marks = [];
        attempts++;
      }
      if (e.type === 'hit' || e.type === 'complete') {
        marks[e.stepIndex] = { kind: 'hit', offset: e.offset };
        if (e.type === 'complete') {
          completes++;
          result.className = 'result ok';
          result.textContent = '完走！';
        } else {
          result.className = 'result';
          result.textContent = `${e.stepIndex + 1}手目 成功`;
        }
      } else {
        const text = describeDrop(e, current, profile.inputBuffer);
        marks[e.stepIndex] = { kind: 'drop', text };
        result.className = 'result ng';
        result.textContent = `${e.stepIndex + 1}手目 失敗: ${text}`;
      }
      renderStats();
      renderSteps();
    },
  };
}
