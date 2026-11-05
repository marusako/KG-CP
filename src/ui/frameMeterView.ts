import { msg } from '../i18n/messages';
import { formatAdvantage } from '../core/dummy';
import type { DummyMode } from '../core/frameData';
import { isEarlyPress, labeledSegments, type FrameMeterCell, type FrameMeterState } from '../core/frameMeter';
import { meterRuns } from '../core/inputMeter';
import { ARROWS } from './arrows';

export interface FrameMeterView {
  /**
   * 帯と帯の下の文を描く。前と同じ中身なら何も書かない。
   * 右端に帯の advantage（有利フレーム）を出す。movesText は技の並びの文（技がなければ空）、noCharacter はキャラなしのとき true（案内を足す）
   */
  render(state: FrameMeterState, movesText: string, noCharacter: boolean): void;
}

/** 相手の切り替えの選択肢（押す順） */
const DUMMY_MODES: readonly DummyMode[] = ['hit', 'block'];

/** 5 マスごとに薄い目盛り、10 マスごとに濃い目盛りをつける */
function tickClass(index: number): string {
  if (index > 0 && index % 10 === 0) return ' tick10';
  if (index > 0 && index % 5 === 0) return ' tick5';
  return '';
}

/**
 * スト6 風の 1 本のフレームメーター。マスは縦 3 段（上: キャラの状態の色と区間の長さ、中: 相手の状態の色、
 * 下: 方向の矢印と新しく押したボタン）。見出しの横に、相手がヒット・ガードのどちらで受けるかの切り替えがある。
 * 色は style.css。積んでいる間は、帯が画面より長ければ右端が見えるように送る
 * （dummyMode は最初に選んでいる切り替え。押したら onDummyMode を呼ぶ）
 */
export function createFrameMeterView(
  root: HTMLElement,
  dummyMode: DummyMode,
  onDummyMode: (mode: DummyMode) => void,
): FrameMeterView {
  const section = document.createElement('section');
  section.className = 'frame-meter-panel';
  const title = document.createElement('h2');
  title.textContent = msg().frameMeterTitle;
  const dummyRow = document.createElement('div');
  dummyRow.className = 'fm-dummy';
  const dummyLabel = document.createElement('span');
  dummyLabel.textContent = `${msg().dummyLabel}:`;
  dummyRow.append(dummyLabel);
  const modeButtons = DUMMY_MODES.map((mode) => {
    const button = document.createElement('button');
    button.textContent = mode === 'hit' ? msg().dummyHit : msg().dummyBlock;
    button.classList.toggle('active', mode === dummyMode);
    button.addEventListener('click', () => {
      button.blur();
      dummyMode = mode;
      modeButtons.forEach((b, i) => b.classList.toggle('active', DUMMY_MODES[i] === mode));
      onDummyMode(mode);
    });
    dummyRow.append(button);
    return button;
  });
  const head = document.createElement('div');
  head.className = 'fm-head';
  head.append(title, dummyRow);
  const scroller = document.createElement('div');
  scroller.className = 'fm-scroll';
  const strip = document.createElement('div');
  strip.className = 'fm-strip';
  scroller.append(strip);
  const advantageEl = document.createElement('div');
  advantageEl.className = 'fm-advantage';
  const band = document.createElement('div');
  band.className = 'fm-band';
  band.append(scroller, advantageEl);
  const movesLine = document.createElement('div');
  movesLine.className = 'meter-summary';
  const runsLine = document.createElement('div');
  runsLine.className = 'meter-summary';
  const legend = document.createElement('div');
  legend.className = 'fm-legend';
  legend.textContent = msg().frameMeterLegend;
  const note = document.createElement('div');
  note.className = 'fm-note';
  section.append(head, band, movesLine, runsLine, legend, note);
  root.append(section);

  let shown: readonly FrameMeterCell[] | null = null;
  let movesShown = '';
  let runsShown = '';
  let noteShown: boolean | null = null;
  let advantageShown: number | null = null;
  /** マスの要素と、いま書いてある値（同じ値なら書き直さないため） */
  interface CellEl {
    col: HTMLElement;
    num: HTMLElement;
    top: HTMLElement;
    opp: HTMLElement;
    bottom: HTMLElement;
    arrow: HTMLElement;
    label: HTMLElement;
    numText: string;
    topCls: string;
    oppCls: string;
    bottomCls: string;
    arrowText: string;
    labelText: string;
  }
  const cellEls: CellEl[] = [];

  function makeCell(index: number): CellEl {
    const col = document.createElement('div');
    col.className = 'fm-col' + tickClass(index);
    const num = document.createElement('div');
    num.className = 'fm-num';
    const top = document.createElement('div');
    const opp = document.createElement('div');
    const bottom = document.createElement('div');
    const arrow = document.createElement('span');
    arrow.className = 'meter-arrow';
    const label = document.createElement('span');
    label.className = 'meter-label';
    bottom.append(arrow, label);
    col.append(num, top, opp, bottom);
    return { col, num, top, opp, bottom, arrow, label, numText: '', topCls: '', oppCls: '', bottomCls: '', arrowText: '', labelText: '' };
  }

  /** 前と違うところだけ書く（textContent は同じ値でも代入するとノードを作り直すため） */
  function fill(el: CellEl, c: FrameMeterCell, numText: string): void {
    if (numText !== el.numText) {
      el.numText = numText;
      el.num.textContent = numText;
    }
    const topCls = `fm-top ${c.state}`;
    if (topCls !== el.topCls) {
      el.topCls = topCls;
      el.top.className = topCls;
    }
    const oppCls = `fm-opp ${c.opponent ?? 'free'}`;
    if (oppCls !== el.oppCls) {
      el.oppCls = oppCls;
      el.opp.className = oppCls;
    }
    const bottomCls =
      'fm-bottom' + (c.pressed.length > 0 ? ' pressed' : c.held.length > 0 ? ' held' : '') + (isEarlyPress(c) ? ' early' : '');
    if (bottomCls !== el.bottomCls) {
      el.bottomCls = bottomCls;
      el.bottom.className = bottomCls;
    }
    const arrowText = ARROWS[c.dir];
    if (arrowText !== el.arrowText) {
      el.arrowText = arrowText;
      el.arrow.textContent = arrowText;
    }
    const labelText = c.pressed.join('+');
    if (labelText !== el.labelText) {
      el.labelText = labelText;
      el.label.textContent = labelText;
    }
  }

  return {
    render(state, movesText, noCharacter) {
      const cells = state.cells;
      const empty = cells.length === 0;
      const moves = empty ? msg().frameMeterEmpty : movesText;
      if (moves !== movesShown) {
        movesShown = moves;
        movesLine.textContent = moves;
      }
      if (noCharacter !== noteShown) {
        noteShown = noCharacter;
        note.textContent = noCharacter ? msg().moveMeterNoCharacter : '';
      }
      if (state.advantage !== advantageShown) {
        advantageShown = state.advantage;
        advantageEl.textContent = state.advantage === null ? '' : formatAdvantage(state.advantage);
        advantageEl.className = `fm-advantage${state.advantage === null ? '' : state.advantage > 0 ? ' plus' : state.advantage < 0 ? ' minus' : ''}`;
      }
      if (cells === shown) return;
      shown = cells;
      // マスの要素は使い回す。長さが変わったときは、足りない分だけ足し、余った分だけ消す
      while (cellEls.length < cells.length) {
        const el = makeCell(cellEls.length);
        cellEls.push(el);
        strip.append(el.col);
      }
      while (cellEls.length > cells.length) cellEls.pop()?.col.remove();
      // 区間の長さの数字は、区間の最初のマスに出す。どの区間に出すかは labeledSegments が決める
      // （帯の先頭の入力だけの部分と、古いほうを捨てて途中で切れた区間には出さない）
      const nums = new Map<number, string>();
      for (const seg of labeledSegments(state)) nums.set(seg.start, String(seg.length));
      cells.forEach((c, i) => fill(cellEls[i] as CellEl, c, nums.get(i) ?? ''));
      const runs = empty ? '' : msg().meterRunsText(meterRuns(cells));
      if (runs !== runsShown) {
        runsShown = runs;
        runsLine.textContent = runs;
      }
      if (state.recording) scroller.scrollLeft = scroller.scrollWidth;
    },
  };
}
