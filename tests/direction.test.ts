import { describe, expect, it } from 'vitest';
import { resolveDirection, stickToPressed } from '../src/input/direction';
import type { PressedDirs } from '../src/input/direction';
import type { Direction } from '../src/core/types';

const p = (s: Partial<PressedDirs> = {}): PressedDirs => ({
  up: false,
  down: false,
  left: false,
  right: false,
  ...s,
});

describe('resolveDirection: 9 方向 (受け入れ条件 5)', () => {
  const table: [string, Partial<PressedDirs>, Direction][] = [
    ['何も押していない', {}, 5],
    ['左下', { left: true, down: true }, 1],
    ['下', { down: true }, 2],
    ['右下', { right: true, down: true }, 3],
    ['左', { left: true }, 4],
    ['右', { right: true }, 6],
    ['左上', { left: true, up: true }, 7],
    ['上', { up: true }, 8],
    ['右上', { right: true, up: true }, 9],
  ];
  for (const socd of ['up', 'neutral'] as const) {
    for (const [name, pressed, expected] of table) {
      it(`${name} → ${expected} (socd=${socd})`, () => {
        expect(resolveDirection(p(pressed), socd)).toBe(expected);
      });
    }
  }
});

describe('resolveDirection: SOCD (受け入れ条件 5)', () => {
  for (const socd of ['up', 'neutral'] as const) {
    it(`左右同時押しは左右ニュートラル (socd=${socd})`, () => {
      expect(resolveDirection(p({ left: true, right: true }), socd)).toBe(5);
      expect(resolveDirection(p({ left: true, right: true, up: true }), socd)).toBe(8);
      expect(resolveDirection(p({ left: true, right: true, down: true }), socd)).toBe(2);
    });
  }

  it('上下同時押しは socd=up なら上', () => {
    expect(resolveDirection(p({ up: true, down: true }), 'up')).toBe(8);
    expect(resolveDirection(p({ up: true, down: true, left: true }), 'up')).toBe(7);
    expect(resolveDirection(p({ up: true, down: true, right: true }), 'up')).toBe(9);
  });

  it('上下同時押しは socd=neutral なら上下ニュートラル', () => {
    expect(resolveDirection(p({ up: true, down: true }), 'neutral')).toBe(5);
    expect(resolveDirection(p({ up: true, down: true, left: true }), 'neutral')).toBe(4);
    expect(resolveDirection(p({ up: true, down: true, right: true }), 'neutral')).toBe(6);
  });

  it('4 方向すべて押しは、左右ニュートラル＋上下は socd に従う', () => {
    const all = p({ up: true, down: true, left: true, right: true });
    expect(resolveDirection(all, 'up')).toBe(8);
    expect(resolveDirection(all, 'neutral')).toBe(5);
  });
});

describe('stickToPressed: deadzone (受け入れ条件 6)', () => {
  it('原点は何も押していない', () => {
    expect(stickToPressed(0, 0, 0.5)).toEqual(p());
  });

  it('各方向 (y は下が正)', () => {
    expect(stickToPressed(1, 0, 0.5)).toEqual(p({ right: true }));
    expect(stickToPressed(-1, 0, 0.5)).toEqual(p({ left: true }));
    expect(stickToPressed(0, 1, 0.5)).toEqual(p({ down: true }));
    expect(stickToPressed(0, -1, 0.5)).toEqual(p({ up: true }));
  });

  it('|値| が deadzone ちょうどなら押していない', () => {
    expect(stickToPressed(0.5, 0, 0.5)).toEqual(p());
    expect(stickToPressed(-0.5, 0, 0.5)).toEqual(p());
    expect(stickToPressed(0, 0.5, 0.5)).toEqual(p());
    expect(stickToPressed(0, -0.5, 0.5)).toEqual(p());
  });

  it('deadzone を超えれば押している', () => {
    expect(stickToPressed(0.51, 0, 0.5)).toEqual(p({ right: true }));
    expect(stickToPressed(-0.51, 0, 0.5)).toEqual(p({ left: true }));
    expect(stickToPressed(0, 0.51, 0.5)).toEqual(p({ down: true }));
    expect(stickToPressed(0, -0.51, 0.5)).toEqual(p({ up: true }));
  });

  it('deadzone 内の小さい傾きは無視される', () => {
    expect(stickToPressed(0.2, -0.3, 0.5)).toEqual(p());
  });

  it('軸ごとに deadzone を判定する (斜め・片軸だけ)', () => {
    expect(stickToPressed(0.9, 0.9, 0.5)).toEqual(p({ right: true, down: true }));
    expect(stickToPressed(-0.9, -0.9, 0.5)).toEqual(p({ left: true, up: true }));
    expect(stickToPressed(0.2, 0.9, 0.5)).toEqual(p({ down: true }));
    expect(stickToPressed(-0.9, 0.2, 0.5)).toEqual(p({ left: true }));
  });
});
