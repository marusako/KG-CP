import { msg } from '../i18n/messages';
import { meterRuns, type MeterCell, type MeterMode, type MeterState } from '../core/inputMeter';
import { ARROWS } from './arrows';

export interface InputMeterView {
  /** state の中身を描く。cells が同じ長さの live のときは、マスの中身だけ書き換える */
  render(state: MeterState): void;
}

/** 入力のフレームメーター。モードの切り替えは onMode で知らせる（保存はしない） */
export function createInputMeterView(root: HTMLElement, onMode: (mode: MeterMode) => void): InputMeterView {
  const section = document.createElement('section');
  section.className = 'meter-panel';
  const head = document.createElement('div');
  head.className = 'meter-head';
  const title = document.createElement('h2');
  title.textContent = msg().meterTitle;
  const modes: readonly (readonly [MeterMode, string])[] = [
    ['freeze', msg().meterFreeze],
    ['live', msg().meterLive],
  ];
  const buttons = modes.map(([mode, label]) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.addEventListener('click', () => {
      onMode(mode);
      b.blur();
    });
    return b;
  });
  head.append(title, ...buttons);
  const strip = document.createElement('div');
  strip.className = 'meter-strip';
  const summary = document.createElement('div');
  summary.className = 'meter-summary';
  section.append(head, strip, summary);
  root.append(section);

  let shown: readonly MeterCell[] | null = null;
  let shownMode: MeterMode | null = null;
  let summaryText = '';
  /** マスの要素と、いま書いてある値（同じ値なら書き直さないため） */
  interface CellEl {
    box: HTMLElement;
    arrow: HTMLElement;
    label: HTMLElement;
    cls: string;
    arrowText: string;
    labelText: string;
  }
  const cellEls: CellEl[] = [];

  function makeCell(): CellEl {
    const box = document.createElement('div');
    const arrow = document.createElement('span');
    arrow.className = 'meter-arrow';
    const label = document.createElement('span');
    label.className = 'meter-label';
    box.append(arrow, label);
    return { box, arrow, label, cls: '', arrowText: '', labelText: '' };
  }

  /** 前と違うところだけ書く（textContent は同じ値でも代入するとノードを作り直すため） */
  function fill(el: CellEl, c: MeterCell): void {
    const cls = 'meter-cell' + (c.pressed.length > 0 ? ' pressed' : c.held.length > 0 ? ' held' : '');
    if (cls !== el.cls) {
      el.cls = cls;
      el.box.className = cls;
    }
    const arrowText = ARROWS[c.dir];
    if (arrowText !== el.arrowText) {
      el.arrowText = arrowText;
      el.arrow.textContent = arrowText;
    }
    const labelText = c.pressed.length > 0 ? c.pressed.join('+') : '';
    if (labelText !== el.labelText) {
      el.labelText = labelText;
      el.label.textContent = labelText;
    }
  }

  return {
    render(state) {
      if (state.mode !== shownMode) {
        shownMode = state.mode;
        buttons.forEach((b, i) => b.classList.toggle('active', modes[i]?.[0] === state.mode));
      }
      if (state.cells === shown) return;
      const cells = state.cells;
      shown = cells;
      // マスの要素は使い回す。長さが変わったときは、足りない分だけ足し、余った分だけ消す
      while (cellEls.length < cells.length) {
        const el = makeCell();
        cellEls.push(el);
        strip.append(el.box);
      }
      while (cellEls.length > cells.length) cellEls.pop()?.box.remove();
      cells.forEach((c, i) => fill(cellEls[i] as CellEl, c));
      const text = msg().meterRunsText(meterRuns(cells));
      if (text !== summaryText) {
        summaryText = text;
        summary.textContent = text;
      }
    },
  };
}
