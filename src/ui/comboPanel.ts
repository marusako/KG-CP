import { msg } from '../i18n/messages';
import { initialTrialState, isAttemptInProgress, parseRecipe, stepTrial } from '../core/combo';
import type { ComboRecipe, TrialEvent, TrialState } from '../core/combo';
import { comboToRecipe } from '../core/characters';
import type { CharacterData } from '../core/characters';
import { initialSimTrial, resolveRecipe, stepSimTrial } from '../core/comboSim';
import type { SimFrame, SimTrialEvent, SimTrialState } from '../core/comboSim';
import { fighterDataFor } from '../core/frameData';
import type { MoveFrames } from '../core/frameData';
import type { GameProfile } from '../core/profiles';
import { filterItems } from '../core/search';
import { createSearchInput } from './searchInput';
import type { PanelRoots } from './panelRoots';
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
      return msg().dropEarly((w?.min ?? 0) - inputBuffer - e.offset);
    }
    case 'late': {
      const w = recipe.steps[e.stepIndex]?.window;
      return msg().dropLate(w?.min ?? 0, w?.max ?? 0);
    }
    case 'wrong':
      return msg().dropWrong;
  }
}

/** 相手に当たってつながったかの判定での、失敗の理由の文。frames は「遅い」「早い」のフレーム数（分からなければ null） */
export function describeSimDrop(e: Extract<SimTrialEvent, { type: 'drop' }>): string {
  switch (e.reason) {
    case 'early':
      return e.frames === null ? msg().dropEarlyLost : msg().dropEarly(e.frames);
    case 'late':
      return e.frames === null ? msg().dropLateRecovered : msg().dropLateBy(e.frames);
    case 'wrong':
      return msg().dropWrong;
  }
}

/**
 * 窓の判定で成功した手の下に出す文。offset は前の手の基準からのフレーム数（最初の手は null）。
 * 窓より早い成功（先行入力）は、何 F 早かったかも出す。前の手が先行入力だと offset はマイナスになりうる
 */
export function describeHit(offset: number | null, window: { min: number; max: number } | null): string {
  if (offset === null) return 'OK';
  const shown = `${offset >= 0 ? '+' : ''}${offset}F`;
  const min = window?.min ?? 0;
  return offset < min ? msg().hitBuffered(shown, min - offset) : shown;
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
  /**
   * 1フレーム進める。コンボトライアルのタブが開いているときだけ呼ぶ。
   * 選んでいるレシピがフレームデータで判定できるなら、sim（キャラと相手の動き）で「相手に当たってつながったか」を判定する。
   * 判定できないレシピ（キャラなし、判定できない手を含むレシピ）は、sim を使わず入力の窓で判定する。sim はキャラがいないときなどは null
   */
  readonly step: (history: readonly FrameInput[], frame: number, sim: SimFrame | null) => void;
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

/**
 * 選ぶ一覧（検索欄・レシピの一覧・JSON の読み込みと書き出し）を roots.select に、
 * 挑戦の様子（選んでいるレシピの名前・手順の箱・結果の文・回数）を roots.status に置く
 */
export function createComboPanel(
  roots: PanelRoots,
  initialProfile: GameProfile,
  initialCharacter?: CharacterData,
): ComboPanel {
  const section = document.createElement('section');
  section.className = 'select-panel';
  const title = document.createElement('h2');
  title.textContent = msg().comboTitle;
  const search = createSearchInput(msg().comboSearchPlaceholder);
  const list = document.createElement('div');
  list.className = 'command-list';
  const listNote = document.createElement('div');
  listNote.className = 'note';
  // JSON の部分はふだん閉じておく。読み込みの結果などの知らせは、閉じていても見えるよう外に出す
  const jsonBox = document.createElement('details');
  jsonBox.className = 'combo-json';
  const jsonSummary = document.createElement('summary');
  jsonSummary.textContent = msg().comboJsonSummary;
  // 押したあとフォーカスが残ると、Space・Enter を練習のボタンに割り当てたとき、押すたびに開閉してしまう
  // （開閉は click のあとに起きるので、blur しても開閉は止まらない）
  jsonSummary.addEventListener('click', () => {
    jsonSummary.blur();
  });
  const jsonArea = document.createElement('textarea');
  jsonArea.rows = 8;
  jsonArea.placeholder = msg().comboJsonPlaceholder;
  const jsonButtons = document.createElement('div');
  const loadBtn = document.createElement('button');
  loadBtn.textContent = msg().comboLoadJson;
  const exportBtn = document.createElement('button');
  exportBtn.textContent = msg().comboExportJson;
  jsonButtons.append(loadBtn, exportBtn);
  jsonBox.append(jsonSummary, jsonArea, jsonButtons);
  const message = document.createElement('div');
  message.className = 'note';
  section.append(title, search, list, listNote, jsonBox, message);
  roots.select.append(section);

  const status = document.createElement('section');
  status.className = 'status-panel';
  const currentName = document.createElement('h2');
  const stepsView = document.createElement('div');
  stepsView.className = 'combo-steps';
  const result = document.createElement('div');
  result.className = 'result';
  const stats = document.createElement('div');
  stats.className = 'note';
  const fallbackNote = document.createElement('div');
  fallbackNote.className = 'note';
  status.append(currentName, fallbackNote, stepsView, result, stats);
  roots.status.append(status);

  let profile = initialProfile;
  let characterId: string | undefined;
  let character: CharacterData | undefined;
  let samples: readonly ComboRecipe[] = [];
  let saved: SavedData = { recipes: [], unreadable: [] };
  let recipes: ComboRecipe[] = [];
  let current = initialProfile.samples[0] as ComboRecipe;
  let state: TrialState = initialTrialState();
  /** 相手に当たってつながったかで判定するときの、手ごとの技の一覧（resolveRecipe）。窓の判定なら null */
  let simMoves: readonly (readonly MoveFrames[])[] | null = null;
  let simState: SimTrialState = initialSimTrial();
  let attempts = 0;
  let completes = 0;
  /** 手ごとの表示状態 */
  let marks: ({ kind: 'hit' | 'drop'; text: string } | null)[] = [];

  const idleText = () => msg().comboIdle;

  const renderSteps = () => {
    stepsView.replaceChildren(
      ...current.steps.map((s, i) => {
        const box = document.createElement('div');
        box.className = 'combo-step';
        const mark = marks[i];
        if (mark?.kind === 'hit') box.classList.add('hit');
        else if (mark?.kind === 'drop') box.classList.add('drop');
        else if (i === (simMoves !== null ? simState.stepIndex : state.stepIndex)) box.classList.add('next');
        const name = document.createElement('div');
        name.textContent = s.text;
        const sub = document.createElement('div');
        sub.className = 'note';
        if (mark !== null && mark !== undefined) sub.textContent = mark.text;
        else if (i === 0) sub.textContent = msg().comboStart;
        else sub.textContent = simMoves !== null ? msg().comboConnect : s.window ? msg().comboWindow(s.window.min, s.window.max) : msg().comboStart;
        box.append(name, sub);
        return box;
      }),
    );
  };

  const renderStats = () => {
    const rate = attempts === 0 ? '-' : `${Math.round((completes / attempts) * 100)}%`;
    stats.textContent = msg().comboStats(attempts, completes, rate);
  };

  /** 挑戦の途中か（どちらの判定でも） */
  const inProgress = () => (simMoves !== null ? simState.stepIndex > 0 : isAttemptInProgress(state));

  /** 最初の手に戻す。レシピを選び直したときも必ず通るので、状態表示の見出しと、どちらの判定にするかもここで合わせる */
  const reset = () => {
    currentName.textContent = current.name;
    const data = character === undefined ? undefined : fighterDataFor(character.id);
    simMoves = data === undefined ? null : resolveRecipe(current, data, profile);
    fallbackNote.textContent = data !== undefined && simMoves === null ? msg().comboWindowFallback : '';
    state = initialTrialState();
    simState = initialSimTrial();
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
      empty.textContent = msg().comboNoMatch;
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

  // 読み込み・書き出しのボタンも、押したらフォーカスを外す（Space・Enter を割り当てたとき、練習中に押し直さないように）
  loadBtn.addEventListener('click', () => {
    loadBtn.blur();
    let json: unknown;
    try {
      json = JSON.parse(jsonArea.value);
    } catch (e) {
      message.className = 'note error';
      message.textContent = msg().jsonUnreadable(e instanceof Error ? e.message : String(e));
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
      message.textContent = msg().idCollision(r.recipe.id);
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
      ? msg().recipeLoaded(r.recipe.name)
      : msg().recipeLoadedNotSaved(r.recipe.name);
    renderStats();
    reset();
    renderList();
  });

  exportBtn.addEventListener('click', () => {
    exportBtn.blur();
    jsonArea.value = toJson(current);
    message.className = 'note';
    message.textContent = msg().recipeExported;
  });

  search.addEventListener('input', renderList);

  /** ゲーム（とキャラ）に合わせて、レシピの一覧と保存データを読み直す */
  const applyProfile = (next: GameProfile, nextCharacter?: CharacterData) => {
    profile = next;
    characterId = nextCharacter?.id;
    character = nextCharacter;
    // キャラのコンボは、読めないものがあれば出さない。一覧が 0 件にならないことは、データのテスト
    // （tests/characters.test.ts の「キャラを足すときの守り」）で確かめている
    samples = nextCharacter
      ? nextCharacter.combos.flatMap((c) => comboToRecipe(c, next) ?? [])
      : next.samples;
    listNote.textContent = nextCharacter ? msg().comboCharacterNote : '';
    search.value = '';
    saved = loadSaved(next, characterId, new Set(samples.map((s) => s.id)));
    recipes = [...samples, ...saved.recipes];
    current = recipes[0] as ComboRecipe;
    attempts = 0;
    completes = 0;
    jsonArea.value = '';
    if (saved.unreadable.length > 0) {
      message.className = 'note error';
      message.textContent = msg().unreadableSaved(saved.unreadable.length);
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
      if (!inProgress()) return;
      reset();
      result.className = 'result ng';
      result.textContent = reason;
    },
    step: (history, frame, sim) => {
      const prevIndex = simMoves !== null ? simState.stepIndex : state.stepIndex;
      let hit: { stepIndex: number; complete: boolean; text: string } | null = null;
      let drop: { stepIndex: number; text: string } | null = null;
      if (simMoves !== null) {
        if (sim === null) return;
        const out = stepSimTrial(simState, simMoves, sim, profile.inputBuffer);
        simState = out.state;
        const e = out.event;
        if (e === null) return;
        if (e.type === 'drop') drop = { stepIndex: e.stepIndex, text: describeSimDrop(e) };
        else {
          const text = e.timing === null ? 'OK' : msg().comboTiming(e.timing.offset, e.timing.window);
          hit = { stepIndex: e.stepIndex, complete: e.type === 'complete', text };
        }
      } else {
        const out = stepTrial(state, current, history, frame, profile.inputBuffer);
        state = out.state;
        const e = out.event;
        if (e === null) return;
        if (e.type === 'drop') drop = { stepIndex: e.stepIndex, text: describeDrop(e, current, profile.inputBuffer) };
        else {
          const text = describeHit(e.offset, current.steps[e.stepIndex]?.window ?? null);
          hit = { stepIndex: e.stepIndex, complete: e.type === 'complete', text };
        }
      }
      if (prevIndex === 0) {
        // 新しい挑戦の開始
        marks = [];
        attempts++;
      }
      if (hit !== null) {
        marks[hit.stepIndex] = { kind: 'hit', text: hit.text };
        if (hit.complete) {
          completes++;
          result.className = 'result ok';
          result.textContent = msg().comboComplete;
        } else {
          result.className = 'result';
          result.textContent = msg().comboStepOk(hit.stepIndex + 1);
        }
      } else if (drop !== null) {
        marks[drop.stepIndex] = { kind: 'drop', text: drop.text };
        result.className = 'result ng';
        result.textContent = msg().comboStepFail(drop.stepIndex + 1, drop.text);
      }
      renderStats();
      renderSteps();
    },
  };
}
