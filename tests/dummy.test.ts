import { describe, expect, it } from 'vitest';
import { CHARACTERS } from '../src/core/characters';
import { INITIAL_DUMMY, formatAdvantage, stepDummy } from '../src/core/dummy';
import type { Contact, DummyState } from '../src/core/dummy';
import { INITIAL_FIGHTER, stepFighter } from '../src/core/fighter';
import type { FighterState } from '../src/core/fighter';
import { fighterDataFor } from '../src/core/frameData';
import type { DummyMode, FighterData, MoveFrames } from '../src/core/frameData';
import { PROFILES } from '../src/core/profiles';
import type { Direction, FrameInput } from '../src/core/types';

const cammy = { data: fighterDataFor('cammy')!, character: CHARACTERS.find((c) => c.id === 'cammy')! };
const mk = (input: string): MoveFrames => cammy.data.moves.find((m) => m.input === input)!;

const N: FrameInput = { dir: 5, buttons: [] };
const LP: FrameInput = { dir: 5, buttons: ['LP'] };
const rep = (n: number, f: FrameInput): FrameInput[] => Array.from({ length: n }, () => f);
const dirs = (...ds: Direction[]): FrameInput[] => ds.map((d) => ({ dir: d, buttons: [] }));

interface Step {
  fighter: FighterState;
  dummy: DummyState;
  contact: Contact | null;
}

/** 本物の stepFighter → stepDummy を 1 フレームずつ進める（stepDummy が返した fighter を次のフレームに渡す） */
function run(inputs: readonly FrameInput[], mode: DummyMode, data: FighterData = cammy.data): Step[] {
  const character = { data, character: cammy.character };
  let fighter: FighterState = INITIAL_FIGHTER;
  let dummy: DummyState = INITIAL_DUMMY;
  const history: FrameInput[] = [];
  const out: Step[] = [];
  for (const f of inputs) {
    history.push(f);
    const next = stepFighter(fighter, history, character, PROFILES.sf6, PROFILES.sf6.inputBuffer);
    const r = stepDummy(dummy, next, mode);
    fighter = r.fighter;
    dummy = r.dummy;
    out.push({ fighter: r.fighter, dummy: r.dummy, contact: r.contact });
  }
  return out;
}

const phases = (ss: Step[]) => ss.map((s) => s.dummy.phase);
const seq = (...parts: [string, number][]): string[] => parts.flatMap(([p, n]) => Array.from({ length: n }, () => p));
const contacts = (ss: Step[]) => ss.flatMap((s, i) => (s.contact ? [[i, s.contact] as const] : []));

describe('formatAdvantage', () => {
  it('プラスは + をつけ、マイナスは - のまま、0 は ±0', () => {
    expect(formatAdvantage(5)).toBe('+5');
    expect(formatAdvantage(38)).toBe('+38');
    expect(formatAdvantage(-2)).toBe('-2');
    expect(formatAdvantage(-36)).toBe('-36');
    expect(formatAdvantage(0)).toBe('±0');
  });
});

describe('INITIAL_DUMMY', () => {
  it('free で remaining 0', () => {
    expect(INITIAL_DUMMY).toEqual({ phase: 'free', remaining: 0 });
  });
});

describe('stepDummy: 1 フレームの決まり', () => {
  const active0 = (move: MoveFrames): FighterState => ({ ...INITIAL_FIGHTER, phase: 'active', frame: 0, move });

  it('何も起きなければ、同じ dummy・同じ fighter を返し、contact は null', () => {
    const r = stepDummy(INITIAL_DUMMY, INITIAL_FIGHTER, 'hit');
    expect(r.dummy).toBe(INITIAL_DUMMY);
    expect(r.fighter).toBe(INITIAL_FIGHTER);
    expect(r.contact).toBeNull();
  });

  it('持続の 1 フレーム目で当たる: 相手は反応の種類と L になり、fighter に contact の印がつく', () => {
    const f = active0(mk('5LP'));
    const r = stepDummy(INITIAL_DUMMY, f, 'hit');
    expect(r.dummy).toEqual({ phase: 'hitstun', remaining: 15 }); // 5+3+7
    expect(r.fighter.contact).toBe(true);
    // 第14段階: 当たったフレームに、技の hitstop（5LP は 9）が fighter に入る
    expect(r.fighter).toEqual({ ...f, contact: true, hitstop: 9 });
    expect(f.contact).toBeUndefined(); // 渡した fighter は書き換えない
    expect(r.contact).toEqual({ kind: 'hit', knockdown: false, combo: false, advantage: 5 });
    const b = stepDummy(INITIAL_DUMMY, f, 'block');
    expect(b.dummy).toEqual({ phase: 'blockstun', remaining: 8 }); // -2+3+7
    expect(b.contact).toEqual({ kind: 'block', knockdown: false, combo: false, advantage: -2 });
  });

  it('ダウンする技（2HK ヒット）は knockdown: true、down 65 フレーム', () => {
    const r = stepDummy(INITIAL_DUMMY, active0(mk('2HK')), 'hit');
    expect(r.dummy).toEqual({ phase: 'down', remaining: 65 }); // 38+3+24
    expect(r.contact).toEqual({ kind: 'hit', knockdown: true, combo: false, advantage: 38 });
  });

  it('持続の 2 フレーム目以降（frame 1）や、startup・recovery では当たらない', () => {
    const lpf = mk('5LP');
    const a1: FighterState = { ...active0(lpf), frame: 1 };
    const s0: FighterState = { ...active0(lpf), phase: 'startup' };
    const r0: FighterState = { ...active0(lpf), phase: 'recovery' };
    for (const f of [a1, s0, r0]) {
      const r = stepDummy(INITIAL_DUMMY, f, 'hit');
      expect(r.contact).toBeNull();
      expect(r.dummy).toBe(INITIAL_DUMMY);
      expect(r.fighter).toBe(f);
    }
  });

  it('当たらないとき、相手の remaining は 1 減り、0 になったら free', () => {
    const r1 = stepDummy({ phase: 'hitstun', remaining: 3 }, INITIAL_FIGHTER, 'hit');
    expect(r1.dummy).toEqual({ phase: 'hitstun', remaining: 2 });
    expect(r1.fighter).toBe(INITIAL_FIGHTER);
    const r2 = stepDummy({ phase: 'hitstun', remaining: 1 }, INITIAL_FIGHTER, 'hit');
    expect(r2.dummy).toEqual({ phase: 'free', remaining: 0 });
    const r3 = stepDummy({ phase: 'down', remaining: 1 }, INITIAL_FIGHTER, 'hit');
    expect(r3.dummy).toEqual({ phase: 'free', remaining: 0 });
    const r4 = stepDummy({ phase: 'blockstun', remaining: 2 }, INITIAL_FIGHTER, 'block');
    expect(r4.dummy).toEqual({ phase: 'blockstun', remaining: 1 });
  });

  it('相手がダウン中なら当たらない（相手は 1 減るだけ）', () => {
    const f = active0(mk('5LP'));
    const r = stepDummy({ phase: 'down', remaining: 10 }, f, 'hit');
    expect(r.contact).toBeNull();
    expect(r.dummy).toEqual({ phase: 'down', remaining: 9 });
    expect(r.fighter).toBe(f);
  });

  it('その切り替えでデータのない技（236LK）は当たらない', () => {
    const f = active0(mk('236LK'));
    for (const mode of ['hit', 'block'] as const) {
      const r = stepDummy(INITIAL_DUMMY, f, mode);
      expect(r.contact).toBeNull();
      expect(r.dummy).toBe(INITIAL_DUMMY);
      expect(r.fighter).toBe(f);
    }
    // 236236K はヒットだけデータがある。ガードでは当たらない
    expect(stepDummy(INITIAL_DUMMY, active0(mk('236236K')), 'hit').contact).not.toBeNull();
    expect(stepDummy(INITIAL_DUMMY, active0(mk('236236K')), 'block').contact).toBeNull();
  });

  describe('combo: 前のフレームの相手が同じ種類の硬直で、remaining > 1', () => {
    const f = active0(mk('5LP'));
    it('hit: hitstun で remaining 2 → true、remaining 1 → false', () => {
      expect(stepDummy({ phase: 'hitstun', remaining: 2 }, f, 'hit').contact?.combo).toBe(true);
      expect(stepDummy({ phase: 'hitstun', remaining: 1 }, f, 'hit').contact?.combo).toBe(false);
    });
    it('hit: 前が blockstun・free なら false', () => {
      expect(stepDummy({ phase: 'blockstun', remaining: 5 }, f, 'hit').contact?.combo).toBe(false);
      expect(stepDummy(INITIAL_DUMMY, f, 'hit').contact?.combo).toBe(false);
    });
    it('block: blockstun で remaining 2 → true（連続ガード）、remaining 1 → false', () => {
      expect(stepDummy({ phase: 'blockstun', remaining: 2 }, f, 'block').contact?.combo).toBe(true);
      expect(stepDummy({ phase: 'blockstun', remaining: 1 }, f, 'block').contact?.combo).toBe(false);
    });
    it('block: 前が hitstun なら false', () => {
      expect(stepDummy({ phase: 'hitstun', remaining: 5 }, f, 'block').contact?.combo).toBe(false);
    });
    it('つながったとき、相手の硬直は新しい技の L に置き換わる（足し算ではない）', () => {
      expect(stepDummy({ phase: 'hitstun', remaining: 4 }, f, 'hit').dummy).toEqual({ phase: 'hitstun', remaining: 15 });
    });
  });
});

describe('相手の反応の長さ (第13段階 受け入れ条件 2。第14段階でヒットストップの分だけ直した)', () => {
  // 5LP を押したフレームを 0 とする。発生前 3 なので、持続の 1 フレーム目は 3
  it('5LP ヒット: フレーム 3 から 15 フレーム hitstun、フレーム 18 から free', () => {
    const ss = run([LP, ...rep(30, N)], 'hit');
    // 第14段階: ヒットストップ 9（4〜12）の間、相手の残りは 15 のまま。
    // 3 フレーム free → 24 フレーム hitstun（3〜26。15 + 9）→ free（27 から）
    expect(phases(ss)).toEqual(seq(['free', 3], ['hitstun', 24], ['free', 4]));
    expect(ss[3]!.dummy).toEqual({ phase: 'hitstun', remaining: 15 });
    expect(ss[12]!.dummy).toEqual({ phase: 'hitstun', remaining: 15 });
    expect(ss[13]!.dummy).toEqual({ phase: 'hitstun', remaining: 14 });
    expect(ss[26]!.dummy).toEqual({ phase: 'hitstun', remaining: 1 });
    expect(ss[27]!.dummy).toEqual({ phase: 'free', remaining: 0 });
  });

  it('5LP ガード: フレーム 3 から 8 フレーム blockstun、そのあと free', () => {
    const ss = run([LP, ...rep(20, N)], 'block');
    // ヒットストップ 9 を含めて 17 フレーム（3〜19）
    expect(phases(ss)).toEqual(seq(['free', 3], ['blockstun', 17], ['free', 1]));
  });

  it('当たるのは持続の 1 フレーム目の 1 回だけ（持続 3 フレームのうち 1 回）', () => {
    const ss = run([LP, ...rep(20, N)], 'hit');
    const cs = contacts(ss);
    expect(cs).toHaveLength(1);
    expect(cs[0]![0]).toBe(3);
    expect(cs[0]![1]).toEqual({ kind: 'hit', knockdown: false, combo: false, advantage: 5 });
  });

  it('contact の印は、同じ技のあいだ fighter に残り、当たったフレームだけ contact が返る', () => {
    const ss = run([LP, ...rep(20, N)], 'hit');
    expect(ss[2]!.fighter.contact).toBeUndefined();
    expect(ss.slice(3, 13).every((s) => s.fighter.contact === true)).toBe(true);
  });

  it('2HK ヒット: 持続の 1 フレーム目（8）から 65 フレーム down、そのあと free', () => {
    const ss = run([{ dir: 2, buttons: ['HK'] }, ...rep(100, N)], 'hit');
    // 8 フレーム free → 78 フレーム down（8〜85。65 + ヒットストップ 13）→ free（86 から）
    expect(phases(ss)).toEqual(seq(['free', 8], ['down', 78], ['free', 15]));
    expect(contacts(ss)[0]![1]).toEqual({ kind: 'hit', knockdown: true, combo: false, advantage: 38 });
  });

  it('2HK ガード: 17 フレーム blockstun', () => {
    const ss = run([{ dir: 2, buttons: ['HK'] }, ...rep(50, N)], 'block');
    expect(phases(ss)).toEqual(seq(['free', 8], ['blockstun', 30], ['free', 13])); // -10+3+24 = 17、ヒットストップ 13 を足して 30
  });

  it('ダウン中に当てても当たらない（2HK のあと、ダウン中に 5LP を出しても contact なし）', () => {
    // 2HK は 0 から。ヒットストップ 13 を入れて 48 から動ける。49 に 5LP → 持続の 1 フレーム目は 52、相手は 8〜85 がダウン
    const inputs = [{ dir: 2, buttons: ['HK'] } as FrameInput, ...rep(48, N), LP, ...rep(50, N)];
    const ss = run(inputs, 'hit');
    expect(contacts(ss).map(([i]) => i)).toEqual([8]); // 2HK の分だけ
    expect(ss[52]!.fighter.move?.input).toBe('5LP');
    expect(ss[52]!.fighter.phase).toBe('active');
    expect(ss[52]!.fighter.contact).toBeUndefined();
    expect(ss[52]!.dummy.phase).toBe('down');
  });

  it('データのない技（236LK）は、ヒットでもガードでも相手は動かない', () => {
    const inputs = [...dirs(2, 3), { dir: 6, buttons: ['LK'] } as FrameInput, ...rep(60, N)];
    for (const mode of ['hit', 'block'] as const) {
      const ss = run(inputs, mode);
      expect(ss.some((s) => s.fighter.move?.input === '236LK')).toBe(true);
      expect(contacts(ss)).toEqual([]);
      expect(ss.every((s) => s.dummy.phase === 'free')).toBe(true);
      expect(ss.every((s) => s.fighter.contact === undefined)).toBe(true);
    }
  });
});

describe('当たったときの硬直（第13段階 受け入れ条件 3、実際のつながり）', () => {
  it('5HK ヒット: 硬直 19 なので、押してから 10+3+19 にヒットストップ 13 を足した 45 フレーム目に動ける', () => {
    const ss = run([{ dir: 5, buttons: ['HK'] }, ...rep(60, N)], 'hit');
    expect(ss[44]!.fighter.phase).toBe('recovery');
    expect(ss[45]!.fighter.phase).toBe('idle');
  });

  it('5HK ガードでも 19（ヒットストップ 13 を足して 45 フレーム目）', () => {
    const ss = run([{ dir: 5, buttons: ['HK'] }, ...rep(60, N)], 'block');
    expect(ss[44]!.fighter.phase).toBe('recovery');
    expect(ss[45]!.fighter.phase).toBe('idle');
  });

  it('相手がダウン中で空振りなら 21: 2HK のダウン中に 5HK を出すと 10+3+21 = 34 フレームかかる', () => {
    // 2HK は 0 から、ヒットストップ 13 を入れて 48 から動ける。49 に 5HK → 持続の 1 フレーム目は 59（相手は 8〜85 がダウン）。
    // 49 から数えて 34 フレーム目 = 83 から動ける
    const HK: FrameInput = { dir: 5, buttons: ['HK'] };
    const ss = run([{ dir: 2, buttons: ['HK'] }, ...rep(48, N), HK, ...rep(60, N)], 'hit');
    expect(ss[49]!.fighter.move?.input).toBe('5HK');
    expect(ss[59]!.fighter.phase).toBe('active');
    expect(ss[59]!.contact).toBeNull();
    expect(ss[82]!.fighter.phase).toBe('recovery');
    expect(ss[83]!.fighter.phase).toBe('idle');
  });
});

describe('目押し (第13段階 受け入れ条件 5。第14段階でヒットストップとチェーンの分だけ直した)', () => {
  // 5LP（0 で押す）。持続の 1 フレーム目は 3、ヒットストップ 9（4〜12）。キャミィは 22 から動ける。
  // ヒットの相手は 3〜12 が残り 15 のまま、13 から 14、13 + (15 - r) で残り r、27 から free（有利 27 - 22 = +5）。
  // 5LP は 5LP へチェーンできる（cancels）ので、4〜15 に押した LP は「キャンセル」: 4〜12 は 13 から、13〜15 は押したフレームから出る。
  // 2 回目を s から出すと、持続の 1 フレーム目は h = s + 3。前のフレーム h-1 の相手が remaining > 1、
  // つまり 27 - (h-1) > 1、h ≤ 26、s ≤ 23 のとき combo
  const second = (p: number, mode: DummyMode, data?: FighterData) => {
    const inputs: FrameInput[] = [LP, ...rep(60, N)];
    inputs[p] = LP;
    const ss = run(inputs, mode, data);
    return { ss, cs: contacts(ss) };
  };

  it('動けるようになる前（13）に押す → キャンセルで 13 から出て、2 回目は combo: true', () => {
    const { ss, cs } = second(13, 'hit');
    expect(ss[13]!.fighter.phase).toBe('startup');
    expect(ss[13]!.fighter.canceled).toBe(true);
    expect(cs.map(([i]) => i)).toEqual([3, 16]);
    expect(cs[1]![1]).toEqual({ kind: 'hit', knockdown: false, combo: true, advantage: 5 });
  });

  it('その次のフレーム（14）に押す → キャンセルで 14 から出て、combo: true', () => {
    const { cs } = second(14, 'hit');
    expect(cs.map(([i]) => i)).toEqual([3, 17]);
    expect(cs[1]![1].combo).toBe(true);
  });

  it('15 に押す → キャンセルの窓の最後（硬直の最初の 1F）。15 から出て combo: true', () => {
    const { ss, cs } = second(15, 'hit');
    expect(ss[15]!.fighter.canceled).toBe(true);
    expect(cs.map(([i]) => i)).toEqual([3, 18]);
    expect(cs[1]![1].combo).toBe(true);
  });

  it('動けるようになった最初のフレーム（22）・23 に押す（キャンセルではない目押し）→ combo: true。24 なら false', () => {
    for (const [p, expected] of [[22, true], [23, true], [24, false]] as const) {
      const { ss, cs } = second(p, 'hit');
      expect(ss[p]!.fighter.phase, `p=${p}`).toBe('startup');
      expect(ss[p]!.fighter.canceled, `p=${p}`).toBeUndefined();
      expect(cs.map(([i]) => i), `p=${p}`).toEqual([3, p + 3]);
      expect(cs[1]![1].combo, `p=${p}`).toBe(expected);
    }
  });

  it('さらに遅く押しても false', () => {
    const { cs } = second(35, 'hit');
    expect(cs[1]![1].combo).toBe(false);
  });

  it('ヒットストップ中・硬直中に押した先行入力（9〜12 に押す）は、13 に出て combo: true', () => {
    for (const p of [9, 10, 11, 12]) {
      const { ss, cs } = second(p, 'hit');
      expect(ss[13]!.fighter.phase, `p=${p}`).toBe('startup');
      expect(cs.map(([i]) => i), `p=${p}`).toEqual([3, 16]);
      expect(cs[1]![1].combo, `p=${p}`).toBe(true);
    }
  });

  it('つながったとき、相手の硬直は 2 回目の L（15）に置き換わる（2 回目のヒットストップ 9 の間は 15 のまま）', () => {
    const { ss } = second(13, 'hit');
    expect(ss[16]!.dummy).toEqual({ phase: 'hitstun', remaining: 15 });
    expect(ss[25]!.dummy).toEqual({ phase: 'hitstun', remaining: 15 });
    expect(ss[26]!.dummy).toEqual({ phase: 'hitstun', remaining: 14 });
    expect(ss[39]!.dummy).toEqual({ phase: 'hitstun', remaining: 1 });
    expect(ss[40]!.dummy.phase).toBe('free');
  });

  it('ガード: キャンセルでつなぐと、連続ガード（ブロック中の相手に続けて当たる）で combo: true', () => {
    // 5LP ガードの相手は 3〜19 が硬直（8 + ヒットストップ 9）、20 から free。キャンセルなら 13〜15 から次が出て、まだ硬直の中
    for (const p of [9, 13, 14]) {
      const { cs } = second(p, 'block');
      expect(cs).toHaveLength(2);
      expect(cs[1]![1], `p=${p}`).toMatchObject({ kind: 'block', combo: true, advantage: -2 });
    }
  });

  it('ガード: キャミィの 5LP は -2 なので、キャンセルせず動けるフレーム（22 以降）に押すと連続ガードにならない', () => {
    // 5LP ガードの相手は 20 から free。キャミィが動けるのは 22。18〜21 に押した先行入力は 22 に出る
    for (const p of [18, 22, 23]) {
      const { cs } = second(p, 'block');
      expect(cs).toHaveLength(2);
      expect(cs[1]![1], `p=${p}`).toMatchObject({ kind: 'block', combo: false, advantage: -2 });
    }
  });

  it('ガード: 有利が大きい技なら連続ガードになる（5LP のガード有利だけ +6 にしたデータ）', () => {
    // 5LP のガード有利を +6 にすると、L = 6+3+7 = 16。相手は 3〜27 が硬直（16 + ヒットストップ 9）、28 から free。キャミィは 22 から動ける。
    // 動けるフレームから押す（キャンセルではない）と、s で出て h = s + 3。combo は h ≤ 27、s ≤ 24
    const data: FighterData = {
      ...cammy.data,
      moves: cammy.data.moves.map((m) => (m.input === '5LP' ? { ...m, onBlock: 6 } : m)),
    };
    for (const [p, expected] of [[22, true], [24, true], [25, false]] as const) {
      const { cs } = second(p, 'block', data);
      expect(cs).toHaveLength(2);
      expect(cs[0]![1]).toMatchObject({ kind: 'block', combo: false, advantage: 6 });
      expect(cs[1]![1], `p=${p}`).toMatchObject({ kind: 'block', combo: expected });
    }
  });
});

describe('stepDummy: ヒットストップ (第14段階 受け入れ条件 2)', () => {
  const active0 = (move: MoveFrames): FighterState => ({ ...INITIAL_FIGHTER, phase: 'active', frame: 0, move });

  it('当たったとき、技の hitstop が fighter.hitstop に入る（ヒットでもガードでも同じ）', () => {
    for (const [input, h] of [['5LP', 9], ['5HK', 13], ['2MK', 9], ['623LK', 12], ['236236K', 5], ['236236P', 20]] as const) {
      const r = stepDummy(INITIAL_DUMMY, active0(mk(input)), 'hit');
      expect(r.fighter.hitstop, input).toBe(h);
      expect(r.fighter.contact, input).toBe(true);
    }
    expect(stepDummy(INITIAL_DUMMY, active0(mk('5LP')), 'block').fighter.hitstop).toBe(9);
    expect(stepDummy(INITIAL_DUMMY, active0(mk('2HK')), 'block').fighter.hitstop).toBe(13);
  });

  it('当たらなかったとき（236LK・ダウン中の相手）は hitstop が入らない', () => {
    expect(stepDummy(INITIAL_DUMMY, active0(mk('236LK')), 'hit').fighter.hitstop).toBeUndefined();
    const r = stepDummy({ phase: 'down', remaining: 10 }, active0(mk('5LP')), 'hit');
    expect(r.fighter.hitstop).toBeUndefined();
  });

  it('fighter.frozen なら、相手は止まる: 同じ dummy・同じ fighter・contact: null（相手の残りも減らない）', () => {
    const f: FighterState = { ...active0(mk('5LP')), frozen: true, hitstop: 5, contact: true };
    for (const d of [INITIAL_DUMMY, { phase: 'hitstun', remaining: 15 }, { phase: 'blockstun', remaining: 3 }, { phase: 'down', remaining: 1 }] as DummyState[]) {
      const r = stepDummy(d, f, 'hit');
      expect(r.dummy).toBe(d);
      expect(r.fighter).toBe(f);
      expect(r.contact).toBeNull();
    }
  });

  it('止まっているフレームでは、持続の 1 フレーム目でも当たらない', () => {
    const f: FighterState = { ...active0(mk('5LP')), frozen: true };
    const r = stepDummy(INITIAL_DUMMY, f, 'hit');
    expect(r.contact).toBeNull();
    expect(r.fighter.hitstop).toBeUndefined();
  });

  it('本物の stepFighter と進める: 5LP のヒットストップ 4〜12（9 フレーム）は、相手が残り 15 のまま止まる', () => {
    const ss = run([LP, ...rep(30, N)], 'hit');
    expect(ss[3]!.fighter.hitstop).toBe(9);
    for (let i = 4; i <= 12; i++) {
      expect(ss[i]!.fighter.frozen, `i=${i}`).toBe(true);
      expect(ss[i]!.dummy, `i=${i}`).toEqual({ phase: 'hitstun', remaining: 15 });
      expect(ss[i]!.contact, `i=${i}`).toBeNull();
    }
    expect(ss[13]!.fighter.frozen).toBeUndefined();
    expect(ss[13]!.dummy).toEqual({ phase: 'hitstun', remaining: 14 });
  });

  it('止まっている間はダウン中でも相手の残りが減らない（2HK は 22 から減り始める）', () => {
    const ss = run([{ dir: 2, buttons: ['HK'] }, ...rep(100, N)], 'hit');
    // 2HK は 8 で当たり、ヒットストップ 13 は 9〜21
    expect(ss[8]!.dummy).toEqual({ phase: 'down', remaining: 65 });
    expect(ss[21]!.dummy).toEqual({ phase: 'down', remaining: 65 });
    expect(ss[22]!.dummy).toEqual({ phase: 'down', remaining: 64 });
  });
});
