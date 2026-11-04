export interface MenuItem {
  label: string;
  /** true なら選べない（カーソルが止まらない） */
  disabled?: boolean;
}

/** 最初の選べる項目の番号。選べる項目がなければ -1 */
export function firstEnabled(items: readonly MenuItem[]): number {
  return items.findIndex((it) => !it.disabled);
}

/**
 * カーソルを delta（+1 で下、-1 で上）の方向の、次の選べる項目へ動かす。
 * 端を越えたら反対の端から続ける。選べない項目は飛ばす。
 * 選べる項目がほかになければ、cursor をそのまま返す
 */
export function moveCursor(items: readonly MenuItem[], cursor: number, delta: 1 | -1): number {
  const n = items.length;
  for (let step = 1; step < n; step++) {
    const i = (((cursor + delta * step) % n) + n) % n;
    if (!items[i]?.disabled) return i;
  }
  return cursor;
}

/** メニューの操作に使う、いま押しているもの */
export interface MenuButtons {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  confirm: boolean;
  back: boolean;
}
export type MenuAction = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back';

export const NO_MENU_BUTTONS: MenuButtons = {
  up: false,
  down: false,
  left: false,
  right: false,
  confirm: false,
  back: false,
};

const ACTION_ORDER: readonly MenuAction[] = ['up', 'down', 'left', 'right', 'confirm', 'back'];

/** prev では押していなくて now で押しているものを、up, down, left, right, confirm, back の順で返す */
export function menuActions(prev: MenuButtons, now: MenuButtons): MenuAction[] {
  return ACTION_ORDER.filter((a) => now[a] && !prev[a]);
}
