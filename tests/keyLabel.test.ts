import { describe, expect, it } from 'vitest';
import { keyLabel } from '../src/input/keyLabel';

describe('keyLabel (受け入れ条件 3)', () => {
  it('KeyA〜KeyZ は A〜Z', () => {
    for (let i = 0; i < 26; i++) {
      const ch = String.fromCharCode(65 + i);
      expect(keyLabel(`Key${ch}`)).toBe(ch);
    }
  });

  it('Digit0〜Digit9 は 0〜9', () => {
    for (let i = 0; i <= 9; i++) expect(keyLabel(`Digit${i}`)).toBe(String(i));
  });

  it('Numpad0〜Numpad9 は テンキー0〜テンキー9', () => {
    for (let i = 0; i <= 9; i++) expect(keyLabel(`Numpad${i}`)).toBe(`テンキー${i}`);
  });

  it('矢印キー', () => {
    expect(keyLabel('ArrowUp')).toBe('↑');
    expect(keyLabel('ArrowDown')).toBe('↓');
    expect(keyLabel('ArrowLeft')).toBe('←');
    expect(keyLabel('ArrowRight')).toBe('→');
  });

  it('Space・Shift・Ctrl・Enter', () => {
    expect(keyLabel('Space')).toBe('Space');
    expect(keyLabel('ShiftLeft')).toBe('左Shift');
    expect(keyLabel('ShiftRight')).toBe('右Shift');
    expect(keyLabel('ControlLeft')).toBe('左Ctrl');
    expect(keyLabel('ControlRight')).toBe('右Ctrl');
    expect(keyLabel('Enter')).toBe('Enter');
  });

  it('それ以外は code のまま', () => {
    expect(keyLabel('Escape')).toBe('Escape');
    expect(keyLabel('Semicolon')).toBe('Semicolon');
    expect(keyLabel('F5')).toBe('F5');
    expect(keyLabel('')).toBe('');
  });
});
