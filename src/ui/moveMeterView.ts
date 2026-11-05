import { msg } from '../i18n/messages';
import type { MoveMeterKind, MoveMeterState } from '../core/moveMeter';

export interface MoveMeterView {
  /** 帯と文を描く。前と同じ中身なら何も書かない。text は帯の下の文（技名とフレーム、または案内） */
  render(state: MoveMeterState, text: string): void;
}

/** 技のフレームメーター。発生は緑、持続は赤、硬直は青、ジャンプは灰（色は style.css） */
export function createMoveMeterView(root: HTMLElement): MoveMeterView {
  const section = document.createElement('section');
  section.className = 'move-meter-panel';
  const title = document.createElement('h2');
  title.textContent = msg().moveMeterTitle;
  const strip = document.createElement('div');
  strip.className = 'move-meter-strip';
  const summary = document.createElement('div');
  summary.className = 'meter-summary';
  section.append(title, strip, summary);
  root.append(section);

  let shown: readonly MoveMeterKind[] | null = null;
  let summaryText = '';
  /** マスの要素と、いま書いてあるクラス（同じなら書き直さないため） */
  const cellEls: { box: HTMLElement; cls: string }[] = [];

  return {
    render(state, text) {
      if (text !== summaryText) {
        summaryText = text;
        summary.textContent = text;
      }
      if (state.cells === shown) return;
      const cells = state.cells;
      shown = cells;
      // マスの要素は使い回す。長さが変わったときは、足りない分だけ足し、余った分だけ消す
      while (cellEls.length < cells.length) {
        const box = document.createElement('div');
        cellEls.push({ box, cls: '' });
        strip.append(box);
      }
      while (cellEls.length > cells.length) cellEls.pop()?.box.remove();
      cells.forEach((kind, i) => {
        const el = cellEls[i];
        if (el === undefined) return;
        const cls = `move-cell ${kind}`;
        if (cls !== el.cls) {
          el.cls = cls;
          el.box.className = cls;
        }
      });
    },
  };
}
