import { msg } from '../i18n/messages';
import { createSearchInput } from './searchInput';
import { filterItems } from '../core/search';
import type { AttemptResult, CommandDef } from '../core/types';
import type { PanelRoots } from './panelRoots';

const RECENT_ATTEMPTS = 20;

export function describeResult(r: AttemptResult): string {
  const m = msg();
  if (r.ok) return m.resultOk(r.motionFrames, r.buttonDelay);
  switch (r.reason) {
    case 'incomplete':
      if (r.matchedSteps === 0) return m.resultNoFirstStep(r.expected.join('/'));
      return m.resultIncomplete(r.matchedSteps, r.expected.join('/'));
    case 'too-slow':
      return m.resultTooSlow(r.motionFrames);
    case 'step-slow':
      return m.resultStepSlow(r.from.join('/'), r.to.join('/'), r.frames, r.limit);
    case 'button-late':
      return m.resultButtonLate(r.buttonDelay);
    case 'charge-short':
      return m.resultChargeShort(r.heldFrames);
    case 'rotation-incomplete':
      return m.resultRotationIncomplete(r.missing.map((d) => m.dir[d]).join(m.dirSep));
  }
}

/** 検索欄で照らし合わせる文字列。表示名・表記と、検索用の別名（キャラの技の英語名と日本語名） */
export function commandSearchTexts(c: CommandDef): string[] {
  return [c.name, c.notation, ...(c.searchNames ?? [])];
}

export interface CommandPanel {
  readonly selected: () => CommandDef;
  readonly showResult: (r: AttemptResult) => void;
  /** 一覧を入れ替え、先頭を選ぶ（成功率も数え直し、検索欄は空に戻す）。notes は技の id → 注記 */
  readonly setCommands: (commands: readonly CommandDef[], notes?: ReadonlyMap<string, string>) => void;
}

/** 選ぶ一覧（検索欄と技の一覧）を roots.select に、判定の結果（選んでいる技の名前・注記・判定の文・成功率）を roots.status に置く */
export function createCommandPanel(
  roots: PanelRoots,
  commands: readonly CommandDef[],
  initialNotes: ReadonlyMap<string, string> = new Map(),
): CommandPanel {
  const section = document.createElement('section');
  section.className = 'select-panel';
  const title = document.createElement('h2');
  title.textContent = msg().practiceTitle;
  const search = createSearchInput(msg().practiceSearchPlaceholder);
  const list = document.createElement('div');
  list.className = 'command-list';
  section.append(title, search, list);
  roots.select.append(section);

  const status = document.createElement('section');
  status.className = 'status-panel';
  const currentName = document.createElement('h2');
  const moveNote = document.createElement('div');
  moveNote.className = 'note';
  const result = document.createElement('div');
  result.className = 'result';
  result.textContent = msg().practiceIdle;
  const rate = document.createElement('div');
  rate.className = 'note';
  status.append(currentName, moveNote, result, rate);
  roots.status.append(status);

  let all = commands;
  let notes = initialNotes;
  let current = commands[0] as CommandDef;
  let recent: boolean[] = [];

  const updateRate = () => {
    const ok = recent.filter(Boolean).length;
    rate.textContent =
      recent.length === 0
        ? msg().recentRateNone
        : msg().recentRate(Math.round((ok / recent.length) * 100), ok, recent.length);
  };

  /** 状態表示の見出し（選んでいる技の名前）と注記 */
  const updateNote = () => {
    currentName.textContent = current.name;
    moveNote.textContent = notes.get(current.id) ?? '';
  };

  const resetView = () => {
    recent = [];
    result.className = 'result';
    result.textContent = msg().practiceIdle;
    updateRate();
  };

  const renderList = () => {
    // 絞り込んで選んでいる技が一覧から消えても、選択はそのまま
    const shown = filterItems(all, search.value, commandSearchTexts);
    if (shown.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'note';
      empty.textContent = msg().practiceNoMatch;
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
