import { describe, expect, it } from 'vitest';
import { isTextEntry } from '../src/input/keyboard';

describe('isTextEntry: 文字を打つ欄かどうか', () => {
  it('textarea と contenteditable は文字を打つ欄', () => {
    expect(isTextEntry('TEXTAREA', null, false)).toBe(true);
    expect(isTextEntry('DIV', null, true)).toBe(true);
  });

  it('文字を打つ種類の input は文字を打つ欄（type 省略は text 扱い）', () => {
    for (const type of [null, '', 'text', 'search', 'email', 'number', 'password', 'url', 'tel']) {
      expect(isTextEntry('INPUT', type, false)).toBe(true);
    }
  });

  it('チェックボックスやボタンなどの input は文字を打つ欄ではない（キー入力を捨てない）', () => {
    for (const type of ['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file']) {
      expect(isTextEntry('INPUT', type, false)).toBe(false);
    }
  });

  it('type の大文字小文字は区別しない', () => {
    expect(isTextEntry('INPUT', 'CheckBox', false)).toBe(false);
    expect(isTextEntry('INPUT', 'TEXT', false)).toBe(true);
  });

  it('ボタンや普通の要素は文字を打つ欄ではない', () => {
    expect(isTextEntry('BUTTON', null, false)).toBe(false);
    expect(isTextEntry('BODY', null, false)).toBe(false);
  });

  it('select は矢印キーで選ぶ欄なので、文字を打つ欄と同じく扱う', () => {
    expect(isTextEntry('SELECT', null, false)).toBe(true);
  });
});
