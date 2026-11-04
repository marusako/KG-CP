import { describe, expect, it } from 'vitest';
import {
  NO_MENU_BUTTONS,
  firstEnabled,
  menuActions,
  moveCursor,
  type MenuButtons,
  type MenuItem,
} from '../src/core/menu';

const item = (label: string, disabled?: boolean): MenuItem =>
  disabled === undefined ? { label } : { label, disabled };

const btn = (p: Partial<MenuButtons>): MenuButtons => ({ ...NO_MENU_BUTTONS, ...p });

describe('firstEnabled (受け入れ条件 2)', () => {
  it('先頭が選べれば 0', () => {
    expect(firstEnabled([item('a'), item('b')])).toBe(0);
  });

  it('先頭が選べなければ次の選べる項目', () => {
    expect(firstEnabled([item('a', true), item('b', true), item('c')])).toBe(2);
  });

  it('全部選べなければ -1', () => {
    expect(firstEnabled([item('a', true), item('b', true)])).toBe(-1);
  });

  it('空なら -1', () => {
    expect(firstEnabled([])).toBe(-1);
  });
});

describe('moveCursor (受け入れ条件 2)', () => {
  const items = [item('a'), item('b', true), item('c'), item('d', true)];

  it('下へ: 選べない項目を飛ばす', () => {
    expect(moveCursor(items, 0, 1)).toBe(2);
  });

  it('下へ: 最後から先頭へ回る (末尾が選べなくても)', () => {
    expect(moveCursor(items, 2, 1)).toBe(0);
    expect(moveCursor([item('a'), item('b')], 1, 1)).toBe(0);
  });

  it('上へ: 選べない項目を飛ばす', () => {
    expect(moveCursor(items, 2, -1)).toBe(0);
  });

  it('上へ: 先頭から最後へ回る (末尾が選べなければ飛ばす)', () => {
    expect(moveCursor(items, 0, -1)).toBe(2);
    expect(moveCursor([item('a'), item('b')], 0, -1)).toBe(1);
  });

  it('全部選べるなら 1 つずつ動く', () => {
    const all = [item('a'), item('b'), item('c')];
    expect(moveCursor(all, 0, 1)).toBe(1);
    expect(moveCursor(all, 2, -1)).toBe(1);
  });

  it('選べる項目が 1 つだけなら、そのまま', () => {
    const one = [item('a', true), item('b'), item('c', true)];
    expect(moveCursor(one, 1, 1)).toBe(1);
    expect(moveCursor(one, 1, -1)).toBe(1);
  });
});

describe('NO_MENU_BUTTONS (受け入れ条件 3)', () => {
  it('全部 false', () => {
    expect(NO_MENU_BUTTONS).toEqual({
      up: false,
      down: false,
      left: false,
      right: false,
      confirm: false,
      back: false,
    });
  });
});

describe('menuActions (受け入れ条件 3)', () => {
  it('何も押していなければ空', () => {
    expect(menuActions(NO_MENU_BUTTONS, NO_MENU_BUTTONS)).toEqual([]);
  });

  it('押した瞬間だけ返す', () => {
    expect(menuActions(NO_MENU_BUTTONS, btn({ confirm: true }))).toEqual(['confirm']);
  });

  it('押し続けている間は返さない', () => {
    const held = btn({ down: true });
    expect(menuActions(held, held)).toEqual([]);
  });

  it('離したときは返さない', () => {
    expect(menuActions(btn({ back: true }), NO_MENU_BUTTONS)).toEqual([]);
  });

  it('押し続けているものがあっても、新しく押したものだけ返す', () => {
    expect(menuActions(btn({ up: true }), btn({ up: true, right: true }))).toEqual(['right']);
  });

  it('同時に押したら up, down, left, right, confirm, back の順で全部返す', () => {
    const all = btn({ up: true, down: true, left: true, right: true, confirm: true, back: true });
    expect(menuActions(NO_MENU_BUTTONS, all)).toEqual([
      'up',
      'down',
      'left',
      'right',
      'confirm',
      'back',
    ]);
  });

  it('順序は押した順ではなく決まった順', () => {
    expect(menuActions(NO_MENU_BUTTONS, btn({ back: true, left: true, up: true }))).toEqual([
      'up',
      'left',
      'back',
    ]);
  });
});
