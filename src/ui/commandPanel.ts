import { createSearchInput } from './searchInput';
import { filterItems } from '../core/search';
import type { AttemptResult, CommandDef } from '../core/types';

const RECENT_ATTEMPTS = 20;

const DIR_LABEL = { left: '左', down: '下', right: '右', up: '上' } as const;

export function describeResult(r: AttemptResult): string {
  if (r.ok) return `成立！ モーション ${r.motionFrames}F / ボタン遅れ ${r.buttonDelay}F`;
  switch (r.reason) {
    case 'incomplete':
      if (r.matchedSteps === 0) return `最初の手（${r.expected.join('/')}）が入っていません`;
      return `手が足りません（${r.matchedSteps} 手目まで成功。次は ${r.expected.join('/')}）`;
    case 'too-slow':
      return `モーションが遅すぎます（${r.motionFrames}F）`;
    case 'button-late':
      return `ボタンが遅すぎます（最後の手から ${r.buttonDelay}F）`;
    case 'charge-short':
      return `溜めが足りません（${r.heldFrames}F）`;
    case 'rotation-incomplete':
      return `回転が足りません（足りない方向: ${r.missing.map((m) => DIR_LABEL[m]).join('・')}）`;
  }
}

export interface CommandPanel {
  readonly selected: () => CommandDef;
  readonly showResult: (r: AttemptResult) => void;
  /** 一覧を入れ替え、先頭を選ぶ（成功率も数え直し、検索欄は空に戻す）。notes は技の id → 注記 */
  readonly setCommands: (commands: readonly CommandDef[], notes?: ReadonlyMap<string, string>) => void;
}

export function createCommandPanel(
  root: HTMLElement,
  commands: readonly CommandDef[],
  initialNotes: ReadonlyMap<string, string> = new Map(),
): CommandPanel {
  const section = document.createElement('section');
  const title = document.createElement('h2');
  title.textContent = '練習するコマンド';
  const search = createSearchInput('名前・表記で絞り込み（例: 236、spiral）');
  const list = document.createElement('div');
  list.className = 'command-list';
  const moveNote = document.createElement('div');
  moveNote.className = 'note';
  const result = document.createElement('div');
  result.className = 'result';
  result.textContent = 'ボタンを押すと判定します';
  const rate = document.createElement('div');
  rate.className = 'note';
  section.append(title, search, list, moveNote, result, rate);
  root.append(section);

  let all = commands;
  let notes = initialNotes;
  let current = commands[0] as CommandDef;
  let recent: boolean[] = [];

  const updateRate = () => {
    const ok = recent.filter(Boolean).length;
    rate.textContent =
      recent.length === 0
        ? `直近の成功率: -`
        : `直近の成功率: ${Math.round((ok / recent.length) * 100)}%（${ok}/${recent.length}）`;
  };

  const updateNote = () => {
    moveNote.textContent = notes.get(current.id) ?? '';
  };

  const resetView = () => {
    recent = [];
    result.className = 'result';
    result.textContent = 'ボタンを押すと判定します';
    updateRate();
  };

  const renderList = () => {
    // 絞り込んで選んでいる技が一覧から消えても、選択はそのまま
    const shown = filterItems(all, search.value, (c) => [c.name, c.notation]);
    if (shown.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'note';
      empty.textContent = '当たる技がありません';
      list.replaceChildren(empty);
      return;
    }
    const buttons = shown.map((c) => {
      const b = document.createElement('button');
      b.textContent = c.name;
      b.classList.toggle('active', c === current);
      b.addEventListener('click', () => {
        current = c;
        buttons.forEach((x) => x.classList.toggle('active', x === b));
        updateNote();
        resetView();
        b.blur();
      });
      return b;
    });
    list.replaceChildren(...buttons);
  };

  search.addEventListener('input', renderList);
  resetView();
  updateNote();
  renderList();

  return {
    selected: () => current,
    setCommands: (next, nextNotes = new Map()) => {
      all = next;
      notes = nextNotes;
      current = next[0] as CommandDef;
      search.value = '';
      updateNote();
      renderList();
      resetView();
    },
    showResult: (r) => {
      result.className = `result ${r.ok ? 'ok' : 'ng'}`;
      result.textContent = describeResult(r);
      recent.push(r.ok);
      if (recent.length > RECENT_ATTEMPTS) recent.shift();
      updateRate();
    },
  };
}
