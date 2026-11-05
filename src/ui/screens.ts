import { GAMES, findGame, type GameId } from '../core/games';
import { firstEnabled, moveCursor, type MenuAction, type MenuItem } from '../core/menu';
import type { Settings } from '../core/settings';

export type Screen = 'title' | 'gameSelect' | 'settings' | 'credits' | 'exit' | 'game';

const VOLUME_STEP = 5;
const REPO_URL = 'https://github.com/marusako/KG-CP';
const DISCLAIMER =
  '各ゲームの名称は、それぞれの権利者の商標または登録商標です。このアプリは非公式のファンメイドツールで、権利者とは関係ありません。';
const EXIT_MESSAGE = 'ブラウザ版は、ここからは閉じられません。タブを閉じて終了してください';

/** 「戻る」で行く先。title だけ戻れない */
const BACK_TO: Readonly<Record<Exclude<Screen, 'game'>, Screen | null>> = {
  title: null,
  gameSelect: 'title',
  settings: 'title',
  credits: 'settings',
  exit: 'title',
};

export interface ScreensOptions {
  getSettings: () => Settings;
  /** 音量が変わった */
  onVolume: (volume: number) => void;
  /** ゲームが選ばれた（画面は game に切り替わる） */
  onSelectGame: (id: GameId) => void;
  /** 画面が切り替わった */
  onScreen: (screen: Screen, prev: Screen) => void;
}

export interface Screens {
  readonly current: () => Screen;
  /** 画面を切り替える。game のときはメニューを隠す */
  readonly show: (screen: Screen) => void;
  /** メニュー操作（キーボード・パッドから）を 1 つ受ける。game のときは何もしない */
  readonly act: (action: MenuAction) => void;
  /** 1 回の読み取りで押された操作を順に受ける。途中で画面が変わったら、残りは捨てる */
  readonly actAll: (actions: readonly MenuAction[]) => void;
}

interface Page {
  el: HTMLElement;
  items: MenuItem[];
  /** items と同じ順の要素 */
  rows: HTMLElement[];
  /** 決定されたとき */
  onConfirm: (index: number) => void;
  cursor: number;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

export function createScreens(root: HTMLElement, opts: ScreensOptions): Screens {
  const container = el('div', 'screens');
  root.append(container);
  let screen: Screen = 'title';
  const pages = new Map<Exclude<Screen, 'game'>, Page>();
  /** 音量を delta だけ変える（設定画面を作るときに差し込む） */
  let volumeAdjust: (delta: number) => void = () => {};

  const setScreen = (next: Screen): void => {
    const prev = screen;
    screen = next;
    // クリックで残ったフォーカスが、次の画面の Enter・Space で誤って押されないようにする
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    if (next === 'gameSelect') {
      const page = pages.get('gameSelect');
      if (page) {
        const i = GAMES.findIndex((g) => g.id === opts.getSettings().lastGame);
        page.cursor = i >= 0 ? i : firstEnabled(page.items);
      }
    }
    render();
    opts.onScreen(next, prev);
  };

  const render = (): void => {
    container.hidden = screen === 'game';
    for (const [name, page] of pages) {
      page.el.hidden = name !== screen;
      page.rows.forEach((r, i) => r.classList.toggle('cursor', i === page.cursor));
    }
  };

  /** 項目の並びを持つページを作る。rows は呼び出し側が作った要素 */
  const addPage = (
    name: Exclude<Screen, 'game'>,
    title: string,
    items: MenuItem[],
    rows: HTMLElement[],
    onConfirm: (index: number) => void,
    extra: HTMLElement[] = [],
  ): void => {
    const page: Page = { el: el('div', 'screen'), items, rows, onConfirm, cursor: firstEnabled(items) };
    page.el.append(el('h1', 'screen-title', title));
    const list = el('div', 'menu');
    list.append(...rows);
    page.el.append(list, ...extra);
    const backTo = BACK_TO[name];
    if (backTo !== null) {
      const back = el('button', 'menu-back', '戻る');
      back.addEventListener('click', () => {
        setScreen(backTo);
      });
      page.el.append(back);
    }
    rows.forEach((r, i) => {
      r.addEventListener('mouseenter', () => {
        if (!items[i]?.disabled) {
          page.cursor = i;
          render();
        }
      });
    });
    pages.set(name, page);
    container.append(page.el);
  };

  const menuButton = (item: MenuItem, onClick: () => void): HTMLButtonElement => {
    const b = el('button', 'menu-item', item.label);
    b.disabled = item.disabled === true;
    b.addEventListener('click', () => {
      b.blur();
      onClick();
    });
    return b;
  };

  // title
  {
    const items: MenuItem[] = [{ label: 'ゲーム選択' }, { label: '設定' }, { label: 'EXIT' }];
    const targets: Screen[] = ['gameSelect', 'settings', 'exit'];
    const go = (i: number): void => {
      const t = targets[i];
      if (t) setScreen(t);
    };
    addPage('title', 'KG-CP', items, items.map((it, i) => menuButton(it, () => go(i))), go);
  }

  // gameSelect
  {
    const items: MenuItem[] = GAMES.map((g) => ({ label: g.name, disabled: !g.available }));
    const choose = (i: number): void => {
      const g = GAMES[i];
      if (!g?.available) return;
      opts.onSelectGame(g.id);
      setScreen('game');
    };
    addPage('gameSelect', 'ゲーム選択', items, items.map((it, i) => menuButton(it, () => choose(i))), choose);
  }

  // settings
  {
    const items: MenuItem[] = [{ label: '音量' }, { label: 'クレジット' }];
    const volumeRow = el('div', 'menu-item volume-row');
    const slider = el('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '100';
    slider.step = '1';
    slider.value = String(opts.getSettings().volume);
    const value = el('span', 'volume-value', slider.value);
    volumeRow.append(el('span', undefined, '音量'), slider, value);
    const setVolume = (v: number): void => {
      const clamped = Math.min(100, Math.max(0, Math.round(v)));
      slider.value = String(clamped);
      value.textContent = String(clamped);
      opts.onVolume(clamped);
    };
    slider.addEventListener('input', () => {
      setVolume(Number(slider.value));
    });
    // つまみを動かしたあとにフォーカスが残ると、矢印キーが二重に効くので外す
    slider.addEventListener('change', () => {
      slider.blur();
    });
    const creditsBtn = menuButton(items[1] as MenuItem, () => {
      setScreen('credits');
    });
    addPage(
      'settings',
      '設定',
      items,
      [volumeRow, creditsBtn],
      (i) => {
        if (i === 1) setScreen('credits');
      },
      [el('div', 'note', '効果音はまだありません')],
    );
    volumeAdjust = (delta) => {
      setVolume(Number(slider.value) + delta);
    };
  }

  // credits
  {
    const link = el('a', undefined, REPO_URL);
    link.href = REPO_URL;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    const author = el('p');
    author.append('作者: marusako');
    const source = el('p');
    source.append('ソースコード: ', link);
    addPage('credits', 'クレジット', [], [], () => {}, [author, source, el('p', 'note', DISCLAIMER)]);
  }

  // exit
  addPage('exit', 'EXIT', [], [], () => {}, [el('p', undefined, EXIT_MESSAGE)]);

  render();

  const act = (action: MenuAction): void => {
    if (screen === 'game') return;
    const page = pages.get(screen);
    if (!page) return;
    switch (action) {
      case 'up':
      case 'down':
        if (page.items.length > 0) {
          page.cursor = moveCursor(page.items, page.cursor, action === 'up' ? -1 : 1);
          render();
        }
        break;
      case 'left':
      case 'right':
        if (screen === 'settings' && page.cursor === 0) volumeAdjust(action === 'left' ? -VOLUME_STEP : VOLUME_STEP);
        break;
      case 'confirm':
        if (page.cursor >= 0 && !page.items[page.cursor]?.disabled) page.onConfirm(page.cursor);
        break;
      case 'back': {
        const t = BACK_TO[screen];
        if (t) setScreen(t);
        break;
      }
    }
  };

  return {
    current: () => screen,
    show: setScreen,
    act,
    actAll: (actions) => {
      const start = screen;
      for (const a of actions) {
        if (screen !== start) break;
        act(a);
      }
    },
  };
}

export interface GameBar {
  readonly el: HTMLElement;
  readonly setGame: (id: GameId) => void;
}

/** 練習画面の上に出す、ゲーム名と「タイトルへ」ボタン */
export function createGameBar(root: HTMLElement, onBack: () => void): GameBar {
  const bar = el('div', 'game-bar');
  const name = el('strong');
  const note = el('span', 'note');
  const back = el('button', undefined, 'タイトルへ');
  back.addEventListener('click', () => {
    back.blur();
    onBack();
  });
  bar.append(name, note, back);
  root.append(bar);
  return {
    el: bar,
    setGame: (id) => {
      name.textContent = findGame(id)?.name ?? '';
      note.textContent = id === 'sf6' ? '一部の猶予は公開資料の値です（2024年5月時点）' : '猶予は共通の値です';
    },
  };
}
