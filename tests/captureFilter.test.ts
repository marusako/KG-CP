import { describe, expect, it } from 'vitest';
import { emptyIgnore, filterInput, type IgnoreSet, type PadDir, type RawInput } from '../src/input/captureFilter';

const raw = (p: {
  keys?: string[];
  freshKeys?: string[];
  padButtons?: number[];
  padDirs?: PadDir[];
}): RawInput => ({
  keys: new Set(p.keys ?? []),
  freshKeys: new Set(p.freshKeys ?? []),
  padButtons: new Set(p.padButtons ?? []),
  padDirs: new Set(p.padDirs ?? []),
});

const ign = (p: { keys?: string[]; padButtons?: number[]; padDirs?: PadDir[] }): IgnoreSet => ({
  keys: new Set(p.keys ?? []),
  padButtons: new Set(p.padButtons ?? []),
  padDirs: new Set(p.padDirs ?? []),
});

const sorted = <T>(s: ReadonlySet<T>) => [...s].sort();

describe('filterInput (受け入れ条件 8)', () => {
  it('捕まえ中は input が全部空になり、raw の全部が ignore に足される', () => {
    const r = filterInput(
      raw({ keys: ['KeyA', 'KeyB'], freshKeys: ['KeyB'], padButtons: [0, 2], padDirs: ['up', 'left'] }),
      ign({ keys: ['KeyZ'], padButtons: [5], padDirs: ['down'] }),
      true,
    );
    expect(r.input.keys.size).toBe(0);
    expect(r.input.padButtons.size).toBe(0);
    expect(r.input.padDirs.size).toBe(0);
    expect(sorted(r.ignore.keys)).toEqual(['KeyA', 'KeyB', 'KeyZ']);
    expect(sorted(r.ignore.padButtons)).toEqual([0, 2, 5]);
    expect(sorted(r.ignore.padDirs)).toEqual(['down', 'left', 'up']);
  });

  it('捕まえが終わったあとも、押し続けている間は無視が続く', () => {
    const captured = filterInput(raw({ keys: ['KeyA'], padButtons: [1], padDirs: ['right'] }), emptyIgnore(), true);
    const r = filterInput(
      raw({ keys: ['KeyA'], padButtons: [1], padDirs: ['right'] }),
      captured.ignore,
      false,
    );
    expect(r.input.keys.size).toBe(0);
    expect(r.input.padButtons.size).toBe(0);
    expect(r.input.padDirs.size).toBe(0);
    expect(sorted(r.ignore.keys)).toEqual(['KeyA']);
    expect(sorted(r.ignore.padButtons)).toEqual([1]);
    expect(sorted(r.ignore.padDirs)).toEqual(['right']);
  });

  it('離したら ignore から外れる', () => {
    const r = filterInput(raw({}), ign({ keys: ['KeyA'], padButtons: [1], padDirs: ['up'] }), false);
    expect(r.ignore.keys.size).toBe(0);
    expect(r.ignore.padButtons.size).toBe(0);
    expect(r.ignore.padDirs.size).toBe(0);
  });

  it('外れたあとに押せば input に出る', () => {
    const released = filterInput(raw({}), ign({ keys: ['KeyA'], padButtons: [1], padDirs: ['up'] }), false);
    const r = filterInput(
      raw({ keys: ['KeyA'], freshKeys: ['KeyA'], padButtons: [1], padDirs: ['up'] }),
      released.ignore,
      false,
    );
    expect(sorted(r.input.keys)).toEqual(['KeyA']);
    expect(sorted(r.input.padButtons)).toEqual([1]);
    expect(sorted(r.input.padDirs)).toEqual(['up']);
    expect(r.ignore.keys.size).toBe(0);
  });

  it('1 フレーム内の押し直し（keys にも freshKeys にも入っている）は、ignore から外れて input に出る', () => {
    const r = filterInput(raw({ keys: ['KeyA'], freshKeys: ['KeyA'] }), ign({ keys: ['KeyA'] }), false);
    expect(sorted(r.input.keys)).toEqual(['KeyA']);
    expect(r.ignore.keys.has('KeyA')).toBe(false);
  });

  it('パッドで捕まえが終わったフレームのあと、押し続けていても input に出ない', () => {
    const endFrame = filterInput(raw({ padButtons: [0], padDirs: ['down'] }), emptyIgnore(), true);
    const next = filterInput(raw({ padButtons: [0], padDirs: ['down'] }), endFrame.ignore, false);
    expect(next.input.padButtons.size).toBe(0);
    expect(next.input.padDirs.size).toBe(0);
  });

  it('無視していないキー・ボタン・方向は、そのまま input に出る', () => {
    const r = filterInput(
      raw({ keys: ['KeyA', 'KeyB'], padButtons: [0, 3], padDirs: ['up', 'left'] }),
      ign({ keys: ['KeyA'], padButtons: [0], padDirs: ['up'] }),
      false,
    );
    expect(sorted(r.input.keys)).toEqual(['KeyB']);
    expect(sorted(r.input.padButtons)).toEqual([3]);
    expect(sorted(r.input.padDirs)).toEqual(['left']);
  });

  it('引数（raw と ignore）を書き換えない', () => {
    for (const capturing of [true, false]) {
      const rw = raw({ keys: ['KeyA', 'KeyB'], freshKeys: ['KeyB'], padButtons: [0, 2], padDirs: ['up'] });
      const ig = ign({ keys: ['KeyA', 'KeyZ'], padButtons: [0, 5], padDirs: ['down'] });
      filterInput(rw, ig, capturing);
      expect(sorted(rw.keys)).toEqual(['KeyA', 'KeyB']);
      expect(sorted(rw.freshKeys)).toEqual(['KeyB']);
      expect(sorted(rw.padButtons)).toEqual([0, 2]);
      expect(sorted(rw.padDirs)).toEqual(['up']);
      expect(sorted(ig.keys)).toEqual(['KeyA', 'KeyZ']);
      expect(sorted(ig.padButtons)).toEqual([0, 5]);
      expect(sorted(ig.padDirs)).toEqual(['down']);
    }
  });
});
