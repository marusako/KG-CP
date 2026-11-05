import { msg } from '../i18n/messages';
import { isEarlyPress, labeledSegments, type FrameMeterCell, type FrameMeterState } from '../core/frameMeter';
import { meterRuns } from '../core/inputMeter';
import { ARROWS } from './arrows';

export interface FrameMeterView {
  /**
   * 帯と帯の下の文を描く。前と同じ中身なら何も書かない。
   * movesText は技の並びの文（技がなければ空）、noCharacter はキャラなしのとき true（案内を足す）
   */
  render(state: FrameMeterState, movesText: string, noCharacter: boolean): void;
}

/** 5 マスごとに薄い目盛り、10 マスごとに濃い目盛りをつける */
function tickClass(index: number): string {
  if (index > 0 && index % 10 === 0) return ' tick10';
  if (index > 0 && index % 5 === 0) return ' tick5';
  return '';
}

/**
 * スト6 風の 1 本のフレームメーター。マスは縦 2 段（上: 状態の色と区間の長さ、下: 方向の矢印と新しく押したボタン）。
 * 色は style.css。積んでいる間は、帯が画面より長ければ右端が見えるように送る
 */
export function createFrameMeterView(root: HTMLElement): FrameMeterView {
  const section = document.createElement('section');
  section.className = 'frame-meter-panel';
  const title = document.createElement('h2');
  title.textContent = msg().frameMeterTitle;
  const scroller = document.createElement('div');
  scroller.className = 'fm-scroll';
  const strip = document.createElement('div');
  strip.className = 'fm-strip';
  scroller.append(strip);
  const movesLine = document.createElement('div');
  movesLine.className = 'meter-summary';
  const runsLine = document.createElement('div');
  runsLine.className = 'meter-summary';
  const legend = document.createElement('div');
  legend.className = 'fm-legend';
  legend.textContent = msg().frameMeterLegend;
  const note = document.createElement('div');
  note.className = 'fm-note';
  section.append(title, scroller, movesLine, runsLine, legend, note);
  root.append(section);

  let shown: readonly FrameMeterCell[] | null = null;
  let movesShown = '';
  let runsShown = '';
  let noteShown: boolean | null = null;
  /** マスの要素と、いま書いてある値（同じ値なら書き直さないため） */
  interface CellEl {
    col: HTMLElement;
    num: HTMLElement;
    top: HTMLElement;
    bottom: HTMLElement;
    arrow: HTMLElement;
    label: HTMLElement;
    numText: string;
    topCls: string;
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
    const bottom = document.createElement('div');
    const arrow = document.createElement('span');
    arrow.className = 'meter-arrow';
    const label = document.createElement('span');
    label.className = 'meter-label';
    bottom.append(arrow, label);
    col.append(num, top, bottom);
    return { col, num, top, bottom, arrow, label, numText: '', topCls: '', bottomCls: '', arrowText: '', labelText: '' };
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
