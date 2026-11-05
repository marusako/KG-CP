import { describe, expect, it } from 'vitest';
import { FIGHTER_DATA, contactReaction, fighterDataFor, totalFrames } from '../src/core/frameData';
import type { DummyMode, MoveFrames, Reaction } from '../src/core/frameData';

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

// ---- 第13段階 受け入れ条件 1: contactReaction ----
// L = 有利 + 持続 + 当たったときの硬直（プラン「相手の反応の長さ」）。
// 括弧の中の数は「有利 + 持続 + 硬直」。5HK は当たったときの硬直 19、2MP は 14（空振りは 21・17）を使う

const moveOf = (characterId: string, input: string): MoveFrames => {
  const m = fighterDataFor(characterId)!.moves.find((x) => x.input === input);
  if (!m) throw new Error(`${characterId} に ${input} がありません`);
  return m;
};

/** 期待: null（反応なし）、または [kind, L, 有利] */
type Expect = null | readonly [Reaction['kind'], number, number];
type ReactionRow = [string, Expect, Expect];

const CAMMY_REACTIONS: ReactionRow[] = [
  ['5LP', ['hitstun', 15, 5], ['blockstun', 8, -2]], // 5+3+7 / -2+3+7
  ['5MP', ['hitstun', 23, 6], ['blockstun', 16, -1]], // 6+4+13 / -1+4+13
  ['5HP', ['hitstun', 25, 2], ['blockstun', 20, -3]], // 2+3+20 / -3+3+20
  ['5LK', ['hitstun', 15, 2], ['blockstun', 10, -3]], // 2+3+10 / -3+3+10
  ['5MK', ['hitstun', 24, 3], ['blockstun', 17, -4]], // 3+3+18 / -4+3+18
  ['5HK', ['hitstun', 24, 2], ['blockstun', 19, -3]], // 2+3+19 / -3+3+19
  ['2LP', ['hitstun', 15, 5], ['blockstun', 8, -2]], // 5+2+8 / -2+2+8
  ['2MP', ['hitstun', 22, 5], ['blockstun', 15, -2]], // 5+3+14 / -2+3+14
  ['2HP', ['hitstun', 26, 7], ['blockstun', 20, 1]], // 7+4+15 / 1+4+15
  ['2LK', ['hitstun', 13, 3], ['blockstun', 8, -2]], // 3+3+7 / -2+3+7
  ['2MK', ['hitstun', 22, 1], ['blockstun', 16, -5]], // 1+3+18 / -5+3+18
  ['2HK', ['down', 65, 38], ['blockstun', 17, -10]], // 38+3+24 / -10+3+24
  ['236LK', null, null],
  ['236MK', null, null],
  ['236HK', null, null],
  ['623LK', ['down', 72, 20], ['blockstun', 16, -36]], // 20+12+40 / -36+12+40
  ['623MK', ['down', 74, 21], ['blockstun', 17, -36]], // 21+12+41 / -36+12+41（ガードの L は FAT の硬直 16 と合わない技）
  ['623HK', ['down', 78, 22], ['blockstun', 20, -36]], // 22+12+44 / -36+12+44（同上）
  ['214LP', ['hitstun', 22, 2], ['blockstun', 17, -3]], // 2+4+16 / -3+4+16
  ['214MP', ['hitstun', 23, 3], ['blockstun', 18, -2]], // 3+4+16 / -2+4+16
  ['214HP', ['hitstun', 26, 5], ['blockstun', 24, 3]], // 5+4+17 / 3+4+17
  ['236236K', ['down', 64, 10], null], // 10+16+38
  ['214214P', ['down', 58, 12], null], // 12+9+37
  ['236236P', ['down', 70, 17], null], // 17+15+38
];

const BRIDGET_REACTIONS: ReactionRow[] = [
  ['5P', ['hitstun', 13, -3], ['blockstun', 10, -6]], // -3+2+14 / -6+2+14
  ['5K', ['hitstun', 15, 1], ['blockstun', 12, -2]], // 1+5+9 / -2+5+9
  ['5S', ['hitstun', 32, 13], ['blockstun', 20, 1]], // 13+6+13 / 1+6+13
  ['5HS', ['hitstun', 20, -14], ['blockstun', 17, -17]], // -14+5+29 / -17+5+29
  ['5D', ['hitstun', 29, 0], ['blockstun', 14, -15]], // 0+3+26 / -15+3+26
  ['2P', ['hitstun', 13, 0], ['blockstun', 10, -3]], // 0+4+9 / -3+4+9
  ['2K', ['hitstun', 15, 1], ['blockstun', 12, -2]], // 1+3+11 / -2+3+11
  ['2S', ['hitstun', 20, -6], ['blockstun', 17, -9]], // -6+6+20 / -9+6+20
  ['2HS', ['hitstun', 20, -15], ['blockstun', 17, -18]], // -15+11+24 / -18+11+24
  ['2D', null, ['blockstun', 13, -6]], // ヒットは数字なし（HKD） / -6+4+15
  ['236K', ['hitstun', 17, -17], ['blockstun', 14, -20]], // -17+25+9 / -20+25+9
  ['236S', null, null],
  ['236HS', null, null],
  ['623P', null, ['blockstun', 23, -28]], // ヒットは数字なし（KD） / -28+12+39
  ['63214P', null, null],
  ['632146S', null, ['blockstun', 63, -29]], // ヒットは数字なし（HKD） / -29+45+47
];

describe('contactReaction (第13段階 受け入れ条件 1)', () => {
  const check = (characterId: string, rows: ReactionRow[]) => {
    for (const [input, hit, block] of rows) {
      for (const [mode, exp] of [['hit', hit], ['block', block]] as [DummyMode, Expect][]) {
        it(`${characterId} ${input} ${mode}: ${exp ? `${exp[0]} ${exp[1]}F / 有利 ${exp[2]}` : 'null'}`, () => {
          const r = contactReaction(moveOf(characterId, input), mode);
          if (exp === null) {
            expect(r).toBeNull();
          } else {
            expect(r).toEqual({ kind: exp[0], frames: exp[1], advantage: exp[2] });
          }
        });
      }
    }
  };

  describe('キャミィ', () => check('cammy', CAMMY_REACTIONS));
  describe('ブリジット', () => check('bridget', BRIDGET_REACTIONS));

  it('表はそれぞれのキャラの全部の技を 1 回ずつ覆っている', () => {
    expect(CAMMY_REACTIONS.map((r) => r[0]).sort()).toEqual(fighterDataFor('cammy')!.moves.map((m) => m.input).sort());
    expect(BRIDGET_REACTIONS.map((r) => r[0]).sort()).toEqual(fighterDataFor('bridget')!.moves.map((m) => m.input).sort());
  });

  describe('キャミィの L は FAT の hitstun・blockstun と同じ（FAT の値をここに書く）', () => {
    // [入力, FAT の hitstun, FAT の blockstun]
    const FAT: [string, number | null, number | null][] = [
      ['5LP', 15, 8],
      ['5MP', 23, 16],
      ['5HP', 25, 20],
      ['5LK', 15, 10],
      ['5MK', 24, 17],
      ['5HK', 24, 19],
      ['2LP', 15, 8],
      ['2MP', 22, 15],
      ['2HP', 26, 20],
      ['2LK', 13, 8],
      ['2MK', 22, 16],
      ['214LP', 22, 17],
      ['214MP', 23, 18],
      ['214HP', 26, 24],
      ['2HK', null, 17], // ヒットはダウン（hitstun なし）
      ['623LK', null, 16], // 同上。623MK・623HK のガードは FAT と合わないので除く
    ];
    for (const [input, hitstun, blockstun] of FAT) {
      it(`${input}`, () => {
        const m = moveOf('cammy', input);
        if (hitstun !== null) expect(contactReaction(m, 'hit')!.frames).toBe(hitstun);
        expect(contactReaction(m, 'block')!.frames).toBe(blockstun);
      });
    }
  });

  it('反応があるとき、L（frames）はすべて 1 以上', () => {
    for (const [cid, rows] of [['cammy', CAMMY_REACTIONS], ['bridget', BRIDGET_REACTIONS]] as const) {
      for (const [input] of rows) {
        for (const mode of ['hit', 'block'] as const) {
          const r = contactReaction(moveOf(cid, input), mode);
          if (r) expect(r.frames, `${cid} ${input} ${mode}`).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });

  it('5HK・2MP は当たったときの硬直（contactRecovery）が空振りと違い、データに書いてある', () => {
    expect(moveOf('cammy', '5HK').recovery).toBe(21);
    expect(moveOf('cammy', '5HK').contactRecovery).toBe(19);
    expect(moveOf('cammy', '2MP').recovery).toBe(17);
    expect(moveOf('cammy', '2MP').contactRecovery).toBe(14);
  });

  it('データを直接渡しても、式 L = 有利 + 持続 + 硬直 のとおり（contactRecovery があればそれを使う）', () => {
    const base: MoveFrames = { input: 'x', startup: 5, active: 2, recovery: 10, onHit: 3, onBlock: -4 };
    expect(contactReaction(base, 'hit')).toEqual({ kind: 'hitstun', frames: 15, advantage: 3 }); // 3+2+10
    expect(contactReaction(base, 'block')).toEqual({ kind: 'blockstun', frames: 8, advantage: -4 }); // -4+2+10
    const withContact: MoveFrames = { ...base, contactRecovery: 6 };
    expect(contactReaction(withContact, 'hit')).toEqual({ kind: 'hitstun', frames: 11, advantage: 3 }); // 3+2+6
    const kd: MoveFrames = { ...base, onHit: { knockdown: 20 } };
    expect(contactReaction(kd, 'hit')).toEqual({ kind: 'down', frames: 32, advantage: 20 }); // 20+2+10
    expect(contactReaction({ input: 'x', startup: 5, active: 2, recovery: 10 }, 'hit')).toBeNull();
    expect(contactReaction({ input: 'x', startup: 5, active: 2, recovery: 10 }, 'block')).toBeNull();
  });
});
