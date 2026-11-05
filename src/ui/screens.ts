import { LANGS, LANG_NAMES, getLang, type Lang } from '../i18n/lang';
import { msg } from '../i18n/messages';
import { pick } from '../i18n/localized';
import { charactersFor } from '../core/characters';
import { GAMES, findGame, type GameId } from '../core/games';
import { firstEnabled, moveCursor, type MenuAction, type MenuItem } from '../core/menu';
import { profileFor, type PlayableGameId } from '../core/profiles';
import type { Settings } from '../core/settings';

export type Screen = 'title' | 'gameSelect' | 'charSelect' | 'settings' | 'credits' | 'exit' | 'game';

const VOLUME_STEP = 5;
/** 設定画面の「言語」の行の位置（音量の下） */
const LANGUAGE_ROW = 1;
const REPO_URL = 'https://github.com/marusako/KG-CP';
const FAT_URL = 'https://github.com/D4RKONION/FAT';

/** 「戻る」で行く先。title だけ戻れない */
const BACK_TO: Readonly<Record<Exclude<Screen, 'game'>, Screen | null>> = {
  title: null,
  gameSelect: 'title',
  charSelect: 'gameSelect',
  settings: 'title',
  credits: 'settings',
  exit: 'title',
};

export interface ScreensOptions {
  getSettings: () => Settings;
  /** 音量が変わった */
  onVolume: (volume: number) => void;
  /** 言語が選ばれた（いまと同じ言語を選んだときは呼ばない） */
  /** 言語が選ばれた。保存できず切り替えられなかったときは false を返す（設定画面に知らせを出す） */
  onLang: (lang: Lang) => boolean;
  /** ゲームが選ばれた（画面は charSelect に切り替わる） */
  onSelectGame: (id: GameId) => void;
  /** キャラが選ばれた（null はキャラなし）。画面は game に切り替わる */
  onSelectCharacter: (game: PlayableGameId, characterId: string | null) => void;
  /** 画面が切り替わった */
  onScreen: (screen: Screen, prev: Screen) => void;
}

export interface Screens {
  readonly current: () => Screen;
  /** 画面を切り替える。game のときはメニューを隠す */
  readonly show: (screen: Screen) => void;
  /** 設定画面を、カーソルを「言語」の行に合わせて開く（言語を変えて読み直したあと） */
  readonly showLanguageSetting: () => void;
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
  /** キャラ選択の項目を、選んだゲームに合わせて作り直す（setScreen から呼ぶ。中身は charSelect の節で差し込む） */
  let rebuildCharSelect: () => void = () => {};
  /** 音量を delta だけ変える（設定画面を作るときに差し込む） */
  let volumeAdjust: (delta: number) => void = () => {};
  /** 言語を次のものに切り替える（設定画面を作るときに差し込む） */
  let langToggle: () => void = () => {};

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
    if (next === 'charSelect') rebuildCharSelect();
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
      const back = el('button', 'menu-back', msg().back);
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
    const items: MenuItem[] = [{ label: msg().menuGameSelect }, { label: msg().menuSettings }, { label: 'EXIT' }];
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
      setScreen('charSelect');
    };
    addPage('gameSelect', msg().menuGameSelect, items, items.map((it, i) => menuButton(it, () => choose(i))), choose);
  }

  // charSelect（項目は、入るたびに選んだゲームに合わせて作り直す）
  {
    /** いま並べているゲーム。項目の番号 i（1 から）は charactersFor(game)[i - 1] */
    let game: PlayableGameId | null = null;
    const choose = (i: number): void => {
      if (game === null) return;
      const c = i === 0 ? undefined : charactersFor(game)[i - 1];
      if (i > 0 && !c) return;
      opts.onSelectCharacter(game, c?.id ?? null);
      setScreen('game');
    };
    addPage('charSelect', msg().menuCharSelect, [], [], choose);
    const page = pages.get('charSelect') as Page;
    const list = page.el.querySelector('.menu') as HTMLElement;
    rebuildCharSelect = () => {
      const g = profileFor(opts.getSettings().lastGame)?.id ?? null;
      game = g;
      const chars = g === null ? [] : charactersFor(g);
      page.items = [{ label: msg().menuNoCharacter }, ...chars.map((c) => ({ label: pick(c.name, getLang()) }))];
      page.rows = page.items.map((it, i) => {
        const row = menuButton(it, () => choose(i));
        row.addEventListener('mouseenter', () => {
          page.cursor = i;
          render();
        });
        return row;
      });
      list.replaceChildren(...page.rows);
      const last = g === null ? undefined : opts.getSettings().lastCharacter[g];
      const at = chars.findIndex((c) => c.id === last);
      page.cursor = at >= 0 ? at + 1 : 0;
    };
  }

  // settings
  {
    const items: MenuItem[] = [{ label: msg().menuVolume }, { label: msg().menuLanguage }, { label: msg().menuCredits }];
    const volumeRow = el('div', 'menu-item volume-row');
    const slider = el('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '100';
    slider.step = '1';
    slider.value = String(opts.getSettings().volume);
    const value = el('span', 'volume-value', slider.value);
    volumeRow.append(el('span', undefined, msg().menuVolume), slider, value);
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
    // 保存できずに言語を切り替えられなかったときの知らせ
    const langError = el('div', 'note error');
    const chooseLang = (l: Lang): void => {
      langError.textContent = opts.onLang(l) ? '' : msg().langSaveFailed;
    };
    // 言語の行。ボタンで直接選べる。←→・決定では、次の言語に切り替える
    const langRow = el('div', 'menu-item volume-row');
    langRow.append(el('span', undefined, msg().menuLanguage));
    for (const l of LANGS) {
      const b = el('button', l === getLang() ? 'active' : undefined, LANG_NAMES[l]);
      b.addEventListener('click', () => {
        b.blur();
        if (l !== getLang()) chooseLang(l);
      });
      langRow.append(b);
    }
    const creditsBtn = menuButton(items[2] as MenuItem, () => {
      setScreen('credits');
    });
    addPage(
      'settings',
      msg().menuSettings,
      items,
      [volumeRow, langRow, creditsBtn],
      (i) => {
        if (i === 1) langToggle();
        if (i === 2) setScreen('credits');
      },
      [el('div', 'note', msg().settingsNote), langError],
    );
    langToggle = () => {
      const next = LANGS[(LANGS.indexOf(getLang()) + 1) % LANGS.length];
      if (next) chooseLang(next);
    };
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
    author.append(msg().creditsAuthor);
    const source = el('p');
    source.append(msg().creditsSource, link);
    const fatLink = el('a', undefined, FAT_URL);
    fatLink.href = FAT_URL;
    fatLink.target = '_blank';
    fatLink.rel = 'noopener noreferrer';
    const frameData = el('p');
    frameData.append(msg().creditsFrameData, 'FAT (', fatLink, ')');
    addPage('credits', msg().menuCredits, [], [], () => {}, [author, source, frameData, el('p', 'note', msg().disclaimer)]);
  }

  // exit
  addPage('exit', 'EXIT', [], [], () => {}, [el('p', undefined, msg().exitMessage)]);

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
        else if (screen === 'settings' && page.cursor === 1) langToggle();
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
    showLanguageSetting: () => {
      setScreen('settings');
      const page = pages.get('settings');
      if (page) {
        page.cursor = LANGUAGE_ROW;
        render();
      }
    },
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
  /** characterName はキャラを選んでいるときだけ渡す */
  readonly setGame: (id: GameId, characterName?: string) => void;
}

/** 練習画面の上に出す、ゲーム名（とキャラ名）と「キャラ選択へ」「タイトルへ」ボタン */
export function createGameBar(root: HTMLElement, onCharSelect: () => void, onBack: () => void): GameBar {
  const bar = el('div', 'game-bar');
  const name = el('strong');
  const note = el('span', 'note');
  const charSelect = el('button', undefined, msg().barCharSelect);
  charSelect.addEventListener('click', () => {
    charSelect.blur();
    onCharSelect();
  });
  const back = el('button', undefined, msg().barTitle);
  back.addEventListener('click', () => {
    back.blur();
    onBack();
  });
  bar.append(name, note, charSelect, back);
  root.append(bar);
  return {
    el: bar,
    setGame: (id, characterName) => {
      const game = findGame(id)?.name ?? '';
      name.textContent = characterName === undefined ? game : `${game} / ${characterName}`;
      note.textContent = id === 'sf6' ? msg().barNoteSf6 : id === 'ggst' ? msg().barNoteGg : msg().barNoteCommon;
    },
  };
}
