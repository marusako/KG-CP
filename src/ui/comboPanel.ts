import { initialTrialState, parseRecipe, stepTrial } from '../core/combo';
import type { ComboRecipe, TrialEvent, TrialState } from '../core/combo';
import type { CommandDef, FrameInput } from '../core/types';

const STORAGE_KEY = 'kgcp.comboRecipes';

export function describeDrop(e: Extract<TrialEvent, { type: 'drop' }>, recipe: ComboRecipe): string {
  switch (e.reason) {
    case 'early': {
      const w = recipe.steps[e.stepIndex]?.window;
      return `早い（あと ${(w?.min ?? 0) - e.offset}F 遅く）`;
    }
    case 'late': {
      const w = recipe.steps[e.stepIndex]?.window;
      return `遅い（窓は ${w?.min}〜${w?.max}F）`;
    }
    case 'wrong':
      return '違う入力';
  }
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

function loadSaved(commands: readonly CommandDef[], sampleIds: ReadonlySet<string>): SavedData {
  const empty: SavedData = { recipes: [], unreadable: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;
    const list: unknown = JSON.parse(raw);
    if (!Array.isArray(list)) return empty;
    const out: SavedData = { recipes: [], unreadable: [] };
    for (const j of list) {
      const r = parseRecipe(j, commands);
      // サンプルと同じ id のものは一覧に2つ並ぶので、読めなかった扱いにする
      if (r.ok && !sampleIds.has(r.recipe.id)) out.recipes.push(r.recipe);
      else out.unreadable.push(j);
    }
    return out;
  } catch {
    return empty;
  }
}

function save(recipes: readonly ComboRecipe[], unreadable: readonly unknown[]): boolean {
  try {
    const list = [...recipes.map((r) => JSON.parse(toJson(r)) as unknown), ...unreadable];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
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
  /** 挑戦を無効にして、理由を表示する（処理が止まったときなど） */
  readonly invalidate: (reason: string) => void;
}

export function createComboPanel(
  root: HTMLElement,
  commands: readonly CommandDef[],
  samples: readonly ComboRecipe[],
): ComboPanel {
  const section = document.createElement('section');
  const title = document.createElement('h2');
  title.textContent = 'コンボトライアル';
  const list = document.createElement('div');
  list.className = 'command-list';
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
  section.append(title, list, stepsView, result, stats, jsonArea, jsonButtons, message);
  root.append(section);

  const saved = loadSaved(commands, new Set(samples.map((s) => s.id)));
  const recipes: ComboRecipe[] = [...samples, ...saved.recipes];
  if (saved.unreadable.length > 0) {
    message.className = 'note error';
    message.textContent = `読めなかった保存レシピが ${saved.unreadable.length} 件あります（データは消さずに残しています）`;
  }
  let current = recipes[0] as ComboRecipe;
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
        if (mark?.kind === 'hit') sub.textContent = mark.offset === null ? 'OK' : `+${mark.offset}F`;
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
    const buttons = recipes.map((r) => {
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
    const r = parseRecipe(json, commands);
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
    const ok = save(recipes.slice(samples.length), saved.unreadable);
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

  renderList();
  renderStats();
  reset();

  return {
    reset,
    invalidate: (reason) => {
      reset();
      result.className = 'result ng';
      result.textContent = reason;
    },
    step: (history, frame) => {
      const out = stepTrial(state, current, history, frame);
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
        const text = describeDrop(e, current);
        marks[e.stepIndex] = { kind: 'drop', text };
        result.className = 'result ng';
        result.textContent = `${e.stepIndex + 1}手目 失敗: ${text}`;
      }
      renderStats();
      renderSteps();
    },
  };
}
