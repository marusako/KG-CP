import { msg } from '../i18n/messages';
import type { HistoryEntry } from '../core/history';
import { ARROWS } from './arrows';

export function createHistoryView(root: HTMLElement): (entries: readonly HistoryEntry[]) => void {
  const section = document.createElement('section');
  section.className = 'history-panel';
  const title = document.createElement('h2');
  title.textContent = msg().historyTitle;
  const list = document.createElement('div');
  section.append(title, list);
  root.append(section);

  return (entries) => {
    list.replaceChildren(
      ...entries.map((e) => {
        const row = document.createElement('div');
        row.className = 'history-row';
        const dir = document.createElement('span');
        dir.className = 'history-dir';
        dir.textContent = ARROWS[e.dir];
        const btn = document.createElement('span');
        btn.className = 'history-btn';
        btn.textContent = e.buttons.join('+');
        btn.style.fontWeight = e.pressed.length > 0 ? 'bold' : 'normal';
        const frames = document.createElement('span');
        frames.className = 'history-frames';
        frames.textContent = `${e.frames}F`;
        row.append(dir, btn, frames);
        return row;
      }),
    );
  };
}
