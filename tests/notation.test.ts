import { describe, expect, it } from 'vitest';
import { parseStep } from '../src/core/notation';
import { DEFAULT_COMMANDS } from '../src/core/commands';

const JAPANESE = /[぀-ヿ一-鿿]/;

function cmd(id: string) {
  const c = DEFAULT_COMMANDS.find((d) => d.id === id);
  if (!c) throw new Error(`DEFAULT_COMMANDS に ${id} がありません`);
  return c;
}

function ok(text: string) {
  const r = parseStep(text, DEFAULT_COMMANDS);
  if (!r.ok) throw new Error(`読めませんでした: ${text} (${r.error})`);
  return r.input;
}

const sorted = (a: readonly (string | number)[]) => [...a].sort();

describe('parseStep: 通常技 (受け入れ条件 1)', () => {
  it('2LP は kind=normal、dirs=[1,2,3]、buttons=[LP]', () => {
    const i = ok('2LP');
    expect(i.kind).toBe('normal');
    if (i.kind !== 'normal') return;
    expect(sorted(i.dirs)).toEqual([1, 2, 3]);
    expect(i.buttons).toEqual(['LP']);
  });

  it('5MP は dirs=[5]、buttons=[MP]', () => {
    const i = ok('5MP');
    expect(i).toEqual({ kind: 'normal', dirs: [5], buttons: ['MP'] });
  });

  it('6HK は dirs=[6]、buttons=[HK]', () => {
    expect(ok('6HK')).toEqual({ kind: 'normal', dirs: [6], buttons: ['HK'] });
  });

  it('2 以外の 1〜9 は、その方向だけ', () => {
    for (const d of [1, 3, 4, 5, 6, 7, 8, 9]) {
      const i = ok(`${d}LK`);
      expect(i).toEqual({ kind: 'normal', dirs: [d], buttons: ['LK'] });
    }
  });

  it('P / K のまとめ指定は、その系統の 3 ボタンのどれでも', () => {
    const p = ok('5P');
    const k = ok('5K');
    expect(sorted(p.buttons)).toEqual(['HP', 'LP', 'MP']);
    expect(sorted(k.buttons)).toEqual(['HK', 'LK', 'MK']);
  });

  it('前後の空白は無視する', () => {
    expect(ok('  2LP  ')).toEqual(ok('2LP'));
  });
});

describe('parseStep: 必殺技 (受け入れ条件 1)', () => {
  it('236HP は 236P の定義で buttons=[HP]', () => {
    expect(ok('236HP')).toEqual({ kind: 'command', command: cmd('236P'), buttons: ['HP'] });
  });

  it('236P は 236P の定義の buttons のまま', () => {
    expect(ok('236P')).toEqual({
      kind: 'command',
      command: cmd('236P'),
      buttons: cmd('236P').buttons,
    });
  });

  it('それぞれの技を id に対応する定義へ引き当てる', () => {
    const cases: [string, string][] = [
      ['214LP', '214P'],
      ['623MP', '623P'],
      ['41236HP', '41236P'],
      ['63214LP', '63214P'],
    ];
    for (const [text, id] of cases) {
      const i = ok(text);
      expect(i.kind).toBe('command');
      if (i.kind === 'command') expect(i.command).toEqual(cmd(id));
    }
  });

  it('溜め [4]6P は buttons が LP MP HP', () => {
    const i = ok('[4]6P');
    expect(i.kind).toBe('command');
    if (i.kind !== 'command') return;
    expect(i.command).toEqual(cmd('[4]6P'));
    expect(sorted(i.buttons)).toEqual(['HP', 'LP', 'MP']);
  });

  it('溜め [2]8K は K 系の定義に当たる。HK 指定なら [HK]', () => {
    const i = ok('[2]8HK');
    expect(i).toEqual({ kind: 'command', command: cmd('[2]8K'), buttons: ['HK'] });
  });

  it('360 は rotation の 360P に当たる', () => {
    const i = ok('360LP');
    expect(i).toEqual({ kind: 'command', command: cmd('360P'), buttons: ['LP'] });
    expect(cmd('360P').kind).toBe('rotation');
  });

  it('渡した commands の中から探す（空なら読めない）', () => {
    expect(parseStep('236HP', []).ok).toBe(false);
  });
});

describe('parseStep: 読めない表記 (受け入れ条件 1)', () => {
  const bad = ['', 'LP', '2', '236', '2XX', 'abc', '0LP', '236LK', '999HP', '2 LP LP', '[4]6K'];
  for (const text of bad) {
    it(`"${text}" は ok:false`, () => {
      const r = parseStep(text, DEFAULT_COMMANDS);
      expect(r.ok).toBe(false);
    });
  }

  it('error は日本語で、読めなかった表記を含む', () => {
    const r = parseStep('abc', DEFAULT_COMMANDS);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(JAPANESE);
      expect(r.error).toContain('abc');
    }
  });
});
