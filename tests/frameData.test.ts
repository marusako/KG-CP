import { describe, expect, it } from 'vitest';
import { FIGHTER_DATA, fighterDataFor, totalFrames } from '../src/core/frameData';

// [入力, 発生前, 持続, 硬直, FAT の全体]（プラン phase10-fighter.md の表）
type Row = [string, number, number, number, number];

const CAMMY: Row[] = [
  ['5LP', 3, 3, 7, 13],
  ['5MP', 5, 4, 13, 22],
  ['5HP', 7, 3, 20, 30],
  ['5LK', 4, 3, 10, 17],
  ['5MK', 7, 3, 18, 28],
  ['5HK', 10, 3, 21, 34], // 空振りの値（FAT の補足: 空振りは硬直 +2F で 21F）。相手がいないので技はいつも空振り
  ['2LP', 3, 2, 8, 13],
  ['2MP', 6, 3, 17, 26], // 空振りの値（FAT の補足: 空振りは硬直 +3F で 17F）
  ['2HP', 9, 4, 15, 28],
  ['2LK', 4, 3, 7, 14],
  ['2MK', 7, 3, 18, 28],
  ['2HK', 8, 3, 24, 35],
  ['236LK', 8, 13, 21, 42],
  ['236MK', 8, 15, 21, 44],
  ['236HK', 14, 16, 21, 51],
  ['623LK', 4, 12, 40, 56],
  ['623MK', 5, 12, 41, 58],
  ['623HK', 6, 12, 44, 62],
  ['214LP', 20, 4, 16, 40],
  ['214MP', 23, 4, 16, 43],
  ['214HP', 27, 4, 17, 48],
  ['236236K', 8, 16, 38, 62],
  ['214214P', 12, 9, 37, 58],
  ['236236P', 8, 15, 38, 61],
];

const BRIDGET: Row[] = [
  ['5P', 7, 2, 14, 23],
  ['5K', 5, 5, 9, 19],
  ['5S', 6, 6, 13, 25],
  ['5HS', 10, 5, 29, 44],
  ['5D', 19, 3, 26, 48],
  ['2P', 6, 4, 9, 19],
  ['2K', 4, 3, 11, 18],
  ['2S', 10, 6, 20, 36],
  ['2HS', 10, 11, 24, 45],
  ['2D', 12, 4, 15, 31],
  ['236K', 9, 25, 9, 43],
  ['236S', 14, 21, 3, 38],
  ['236HS', 14, 21, 3, 38],
  ['623P', 8, 12, 39, 59],
  ['63214P', 26, 2, 28, 56],
  ['632146S', 10, 45, 47, 102],
];

const TABLES: [string, Row[], { prejump: number; air: number; landing: number }][] = [
  ['cammy', CAMMY, { prejump: 4, air: 38, landing: 3 }],
  ['bridget', BRIDGET, { prejump: 4, air: 31, landing: 6 }],
];

describe('FIGHTER_DATA (第10段階 受け入れ条件 1)', () => {
  it('キャラは cammy と bridget の 2 人だけ', () => {
    expect(FIGHTER_DATA.map((d) => d.characterId).sort()).toEqual(['bridget', 'cammy']);
  });

  it('知らないキャラ id は undefined', () => {
    expect(fighterDataFor('nobody')).toBeUndefined();
  });

  for (const [cid, rows, jump] of TABLES) {
    describe(cid, () => {
      const data = fighterDataFor(cid);

      it('fighterDataFor が FIGHTER_DATA の中のデータを返す', () => {
        expect(data).toBeDefined();
        expect(FIGHTER_DATA).toContain(data);
      });

      it(`技の数は表の ${rows.length} 個で、入力の重複も表にない技もない`, () => {
        const inputs = data!.moves.map((m) => m.input);
        expect(new Set(inputs).size).toBe(inputs.length);
        expect([...inputs].sort()).toEqual(rows.map((r) => r[0]).sort());
      });

      for (const [input, startup, active, recovery, total] of rows) {
        it(`${input}: 発生前 ${startup} / 持続 ${active} / 硬直 ${recovery}、全体 ${total}`, () => {
          const m = data!.moves.find((x) => x.input === input);
          expect(m, `${input} がありません`).toBeDefined();
          expect(m!.startup).toBe(startup);
          expect(m!.active).toBe(active);
          expect(m!.recovery).toBe(recovery);
          // 全体 = 発生 + 持続 + 硬直 − 1 = 発生前 + 持続 + 硬直
          expect(totalFrames(m!)).toBe(total);
        });
      }

      it(`ジャンプは 跳ぶ前 ${jump.prejump} / 空中 ${jump.air} / 着地 ${jump.landing}`, () => {
        expect(data!.jump).toEqual(jump);
      });
    });
  }

  it('totalFrames は 発生前 + 持続 + 硬直', () => {
    expect(totalFrames({ input: 'x', startup: 1, active: 2, recovery: 3 })).toBe(6);
  });
});
