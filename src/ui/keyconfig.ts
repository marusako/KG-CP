import { ACTIONS, BUTTON_NAMES, type Action, type Bindings, saveBindings } from '../input/bindings';
import type { KeyboardReader } from '../input/keyboard';

const LABELS: Record<Action, string> = {
  up: '上', down: '下', left: '左', right: '右',
  LP: 'LP', MP: 'MP', HP: 'HP', LK: 'LK', MK: 'MK', HK: 'HK',
};

export interface KeyConfig {
  /** パッドのボタンが押されたとき、待機中ならその番号を割り当てる */
  readonly onPadButton: (index: number) => void;
}

export function createKeyConfig(root: HTMLElement, bindings: Bindings, keyboard: KeyboardReader): KeyConfig {
  const section = document.createElement('section');
  const title = document.createElement('h2');
  title.textContent = 'キーコンフィグ';
  const grid = document.createElement('div');
  grid.className = 'keyconfig';
  const note = document.createElement('div');
  note.className = 'note';
  note.textContent = '割り当てたい欄をクリックして、キーかパッドのボタンを押してください。';
  section.append(title, grid, note);
  root.append(section);

  let waiting: Action | null = null;
  const keyButtons = new Map<Action, HTMLButtonElement>();
  const padButtons = new Map<Action, HTMLButtonElement>();

  const render = () => {
    for (const a of ACTIONS) {
      const k = keyButtons.get(a);
      if (k) {
        k.textContent = waiting === a ? '入力待ち…' : bindings.keys[a];
        k.classList.toggle('waiting', waiting === a);
      }
      const p = padButtons.get(a);
      if (p && (BUTTON_NAMES as readonly string[]).includes(a)) {
        p.textContent = `パッド ${bindings.pad[a as (typeof BUTTON_NAMES)[number]]}`;
      }
    }
  };

  const finish = () => {
    waiting = null;
    keyboard.captureNext = null;
    saveBindings(bindings);
    render();
  };

  const start = (a: Action) => {
    // フォーカスが残ると Enter/Space の割り当て時に click が誤発火するので外す
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    waiting = a;
    keyboard.captureNext = (code) => {
      bindings.keys[a] = code;
      finish();
    };
    render();
  };

  for (const a of ACTIONS) {
    const label = document.createElement('span');
    label.textContent = LABELS[a];
    const k = document.createElement('button');
    k.addEventListener('click', () => start(a));
    keyButtons.set(a, k);
    grid.append(label, k);
    if ((BUTTON_NAMES as readonly string[]).includes(a)) {
      const p = document.createElement('button');
      p.addEventListener('click', () => start(a));
      padButtons.set(a, p);
      grid.append(p);
    } else {
      grid.append(document.createElement('span'));
    }
  }
  render();

  return {
    onPadButton: (index) => {
      if (waiting === null || !(BUTTON_NAMES as readonly string[]).includes(waiting)) return;
      bindings.pad[waiting as (typeof BUTTON_NAMES)[number]] = index;
      finish();
    },
  };
}
