import { describe, expect, it } from 'vitest';
import { GAMES, findGame } from '../src/core/games';

describe('GAMES (受け入れ条件 1)', () => {
  it('並びは sf6, ggst, mbtl', () => {
    expect(GAMES.map((g) => g.id)).toEqual(['sf6', 'ggst', 'mbtl']);
  });

  it('名前が決まったとおり', () => {
    expect(GAMES.map((g) => g.name)).toEqual([
      'Street Fighter 6',
      'GUILTY GEAR -STRIVE-',
      'メルブラ（今後追加）',
    ]);
  });

  it('mbtl だけ available: false', () => {
    expect(GAMES.map((g) => g.available)).toEqual([true, true, false]);
  });
});

describe('findGame (受け入れ条件 1)', () => {
  it("'ggst' は GUILTY GEAR -STRIVE-", () => {
    expect(findGame('ggst')?.name).toBe('GUILTY GEAR -STRIVE-');
  });

  it('一覧にある id はすべて見つかる', () => {
    for (const g of GAMES) expect(findGame(g.id)).toEqual(g);
  });

  it('ない id・文字列でない値は undefined', () => {
    expect(findGame('xx')).toBeUndefined();
    expect(findGame(1)).toBeUndefined();
    expect(findGame(null)).toBeUndefined();
    expect(findGame(undefined)).toBeUndefined();
  });
});
