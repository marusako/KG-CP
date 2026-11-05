// 第14段階 受け入れ条件 2〜10: 本物の stepFighter → stepDummy → stepFrameMeter をつないで、キャンセルとヒットストップを確かめる。
// フレームは、最初の技のボタンを押したフレームを 0 とする（inputBuffer = 4）。
import { describe, expect, it } from 'vitest';
import { CHARACTERS } from '../src/core/characters';
import { INITIAL_DUMMY, stepDummy } from '../src/core/dummy';
import type { Contact, DummyState } from '../src/core/dummy';
import { INITIAL_FIGHTER, stepFighter } from '../src/core/fighter';
import type { FighterState } from '../src/core/fighter';
import { fighterDataFor } from '../src/core/frameData';
import type { DummyMode } from '../src/core/frameData';
import {
  EMPTY_FRAME_METER,
  FRAME_METER_LEAD,
  FRAME_METER_MAX,
  stepFrameMeter,
} from '../src/core/frameMeter';
import type { FrameMeterState, StateKind } from '../src/core/frameMeter';
import { PROFILES } from '../src/core/profiles';
import type { FrameInput } from '../src/core/types';

const who = {
  cammy: { c: { data: fighterDataFor('cammy')!, character: CHARACTERS.find((c) => c.id === 'cammy')! }, rules: PROFILES.sf6 },
  bridget: { c: { data: fighterDataFor('bridget')!, character: CHARACTERS.find((c) => c.id === 'bridget')! }, rules: PROFILES.ggst },
};

const N: FrameInput = { dir: 5, buttons: [] };
const b = (dir: FrameInput['dir'], ...buttons: string[]): FrameInput => ({ dir, buttons });
const times = <T>(n: number, v: T): T[] => Array.from({ length: n }, () => v);

type Entries = [number, FrameInput][];
const c236 = (f: number, btn: string): Entries => [[f - 2, b(2)], [f - 1, b(3)], [f, b(6, btn)]];
const c623 = (f: number, btn: string): Entries => [[f - 2, b(6)], [f - 1, b(2)], [f, b(3, btn)]];
const c214 = (f: number, btn: string): Entries => [[f - 2, b(2)], [f - 1, b(1)], [f, b(4, btn)]];
const c236236 = (f: number, btn: string): Entries => [
  [f - 5, b(2)], [f - 4, b(3)], [f - 3, b(6)], [f - 2, b(2)], [f - 1, b(3)], [f, b(6, btn)],
];

const ORIGIN = 20; // 最初の技の前の free の長さ。frame n の入力は inputs[ORIGIN + n]

interface Frame {
  fighter: FighterState;
  dummy: DummyState;
  contact: Contact | null;
  meter: FrameMeterState;
}

/** entries は [frame, 入力]（frame は 0 が最初の技のボタン。負の値も可）。frame 0 から length - 1 まで進める */
function play(entries: Entries, length: number, mode: DummyMode, name: keyof typeof who = 'cammy') {
  const { c, rules } = who[name];
  const inputs: FrameInput[] = times(ORIGIN + length, N);
  for (const [f, input] of entries) inputs[ORIGIN + f] = input;
  let fighter: FighterState = INITIAL_FIGHTER;
  let dummy: DummyState = INITIAL_DUMMY;
  let meter = EMPTY_FRAME_METER;
  const history: FrameInput[] = [];
  const out: Frame[] = [];
  for (const input of inputs) {
    history.push(input);
    const stepped = stepFighter(fighter, history, c, rules, rules.inputBuffer);
    const r = stepDummy(dummy, stepped, mode);
    meter = stepFrameMeter(meter, fighter, r.fighter, history, { dummy: r.dummy, contact: r.contact });
    out.push({ fighter: r.fighter, dummy: r.dummy, contact: r.contact, meter });
    fighter = r.fighter;
    dummy = r.dummy;
  }
  return {
    at: (n: number): Frame => out[ORIGIN + n]!,
    /** 帯の、技の frame 0 からのマス（先頭の入力だけの 15 マスを除く） */
    cells: () => out[out.length - 1]!.meter.cells.slice(FRAME_METER_LEAD),
    meter: () => out[out.length - 1]!.meter,
    /** frame 0 からの、各フレームの結果 */
    frames: () => out.slice(ORIGIN),
    contacts: () => out.slice(ORIGIN).flatMap((f, n) => (f.contact ? [[n, f.contact] as const] : [])),
    moveInputs: () => out.slice(ORIGIN).map((f) => f.fighter.move?.input ?? null),
  };
}

const LP = b(5, 'LP');
const LP2 = b(2, 'LP');

describe('ヒットストップ: キャミィの 5LP がヒット、何も押さない (第14段階 受け入れ条件 2)', () => {
  const run = play([[0, LP]], 45, 'hit');

  it('キャラ: 0〜2 発生前、3 で当たる、4〜12 は止まる（frozen、持続の 1 フレーム目のまま）、13・14 持続、15〜21 硬直、22 から動ける', () => {
    for (let n = 0; n <= 2; n++) expect(run.at(n).fighter.phase, `n=${n}`).toBe('startup');
    expect(run.at(3).fighter.phase).toBe('active');
    expect(run.at(3).fighter.frame).toBe(0);
    expect(run.at(3).fighter.frozen).toBeUndefined();
    for (let n = 4; n <= 12; n++) {
      const f = run.at(n).fighter;
      expect([f.phase, f.frame, f.move?.input, f.frozen], `n=${n}`).toEqual(['active', 0, '5LP', true]);
    }
    expect([run.at(13).fighter.phase, run.at(13).fighter.frame]).toEqual(['active', 1]);
    expect([run.at(14).fighter.phase, run.at(14).fighter.frame]).toEqual(['active', 2]);
    for (let n = 15; n <= 21; n++) {
      expect([run.at(n).fighter.phase, run.at(n).fighter.frame], `n=${n}`).toEqual(['recovery', n - 15]);
    }
    expect(run.at(22).fighter.phase).toBe('idle');
    // 止まっているのは 4〜12 だけ
    run.frames().forEach((f, n) => {
      expect(f.fighter.frozen, `n=${n}`).toBe(n >= 4 && n <= 12 ? true : undefined);
    });
  });

  it('相手: 3 でヒット硬直 15、4〜12 は 15 のまま、13 から 14・13…、27 で free', () => {
    for (let n = 0; n <= 2; n++) expect(run.at(n).dummy.phase).toBe('free');
    for (let n = 3; n <= 12; n++) expect(run.at(n).dummy, `n=${n}`).toEqual({ phase: 'hitstun', remaining: 15 });
    expect(run.at(13).dummy).toEqual({ phase: 'hitstun', remaining: 14 });
    expect(run.at(14).dummy).toEqual({ phase: 'hitstun', remaining: 13 });
    expect(run.at(15).dummy.remaining).toBe(12);
    expect(run.at(21).dummy.remaining).toBe(6);
    expect(run.at(22).dummy.remaining).toBe(5);
    expect(run.at(26).dummy).toEqual({ phase: 'hitstun', remaining: 1 });
    expect(run.at(27).dummy).toEqual({ phase: 'free', remaining: 0 });
  });

  it('当たるのは 3 の 1 回だけ（止まっている間・持続の続きでは当たらない）。有利は +5', () => {
    expect(run.contacts()).toEqual([[3, { kind: 'hit', knockdown: false, combo: false, advantage: 5 }]]);
  });

  it('メーター: キャラの段は 緑 3・赤 1・白 9・赤 2・青 7、相手の段は 黄 1・白 9・黄 14、advantage は +5', () => {
    const cells = run.cells();
    const kinds = cells.slice(0, 22).map((c) => c.state);
    const expected: StateKind[] = [
      ...times(3, 'startup' as StateKind),
      'active',
      ...times(9, 'hitstop' as StateKind),
      'active',
      'active',
      ...times(7, 'recovery' as StateKind),
    ];
    expect(kinds).toEqual(expected);
    const opp = cells.slice(0, 28).map((c) => c.opponent);
    expect(opp).toEqual([
      ...times(3, undefined),
      'hitstun',
      ...times(9, 'hitstop'),
      ...times(14, 'hitstun'),
      undefined,
    ]);
    expect(run.meter().advantage).toBe(5);
  });

  it('advantage は、相手が動ける 27 で決まる（その前は null）', () => {
    expect(run.at(26).meter.advantage).toBeNull();
    expect(run.at(27).meter.advantage).toBe(5);
  });
});

describe('ヒットストップ: ガード (第14段階 受け入れ条件 2)', () => {
  const run = play([[0, LP]], 45, 'block');

  it('止まるのは同じ 9 フレーム（4〜12）で、advantage は -2', () => {
    run.frames().forEach((f, n) => {
      expect(f.fighter.frozen, `n=${n}`).toBe(n >= 4 && n <= 12 ? true : undefined);
    });
    expect(run.contacts()).toEqual([[3, { kind: 'block', knockdown: false, combo: false, advantage: -2 }]]);
    expect(run.meter().advantage).toBe(-2);
  });

  it('メーター: キャラは同じ帯。相手は 青系の blockstun 1・白 9・blockstun 7', () => {
    const cells = run.cells();
    expect(cells.slice(0, 22).map((c) => c.state).filter((s) => s === 'hitstop')).toHaveLength(9);
    expect(cells.slice(3, 21).map((c) => c.opponent)).toEqual([
      'blockstun',
      ...times(9, 'hitstop'),
      ...times(7, 'blockstun'),
      undefined,
    ]);
  });
});

describe('チェーン (第14段階 受け入れ条件 3)', () => {
  it('5LP（ヒット）のあと、4〜12 のどこで 2LP を押しても、2LP は 13 から出る（canceled）', () => {
    for (let p = 4; p <= 12; p++) {
      const run = play([[0, LP], [p, LP2]], 40, 'hit');
      const f = run.at(13).fighter;
      expect([f.move?.input, f.phase, f.frame, f.canceled], `p=${p}`).toEqual(['2LP', 'startup', 0, true]);
      expect(run.at(12).fighter.move?.input, `p=${p}`).toBe('5LP');
    }
  });

  it('13・14・15 で押すと、そのフレームから出る', () => {
    for (const p of [13, 14, 15]) {
      const run = play([[0, LP], [p, LP2]], 40, 'hit');
      const f = run.at(p).fighter;
      expect([f.move?.input, f.phase, f.frame, f.canceled], `p=${p}`).toEqual(['2LP', 'startup', 0, true]);
      expect(run.at(p - 1).fighter.move?.input, `p=${p}`).toBe('5LP');
    }
  });

  it('16 で押すとキャンセルにならない（16 のキャラは硬直のまま。2LP は出ない）', () => {
    const run = play([[0, LP], [16, LP2]], 50, 'hit');
    const f = run.at(16).fighter;
    expect([f.move?.input, f.phase, f.canceled]).toEqual(['5LP', 'recovery', undefined]);
    expect(run.moveInputs().includes('2LP')).toBe(false);
  });

  it('チェーンの 2LP は combo: true（4〜15 のどこで押しても）。2LP の当たりは押したフレーム + 3', () => {
    for (const p of [4, 8, 12, 13, 14, 15]) {
      const run = play([[0, LP], [p, LP2]], 45, 'hit');
      const start = Math.max(p, 13);
      const cs = run.contacts();
      expect(cs.map(([n]) => n), `p=${p}`).toEqual([3, start + 3]);
      expect(cs[1]![1], `p=${p}`).toEqual({ kind: 'hit', knockdown: false, combo: true, advantage: 5 });
    }
  });

  it('ガードのチェーンも同じ（2LP は 13 から出て、連続ガードで combo: true）', () => {
    const run = play([[0, LP], [8, LP2]], 45, 'block');
    expect(run.at(13).fighter.canceled).toBe(true);
    expect(run.contacts()[1]![1]).toMatchObject({ kind: 'block', combo: true });
  });

  it('チェーンで出した 2LP も、当たればさらにキャンセルできる（5LP → 2LP → 2LK）', () => {
    // 2LP は 13 から。16 で当たり、ヒットストップ 9（17〜25）。その間の 20 に 2LK
    const run = play([[0, LP], [8, LP2], [20, b(2, 'LK')]], 60, 'hit');
    expect(run.at(26).fighter.move?.input).toBe('2LK');
    expect(run.at(26).fighter.canceled).toBe(true);
    expect(run.at(26).fighter.phase).toBe('startup');
  });
});

describe('キャンセル先でない技 (第14段階 受け入れ条件 4)', () => {
  it('5LP（ヒット）のヒットストップ中に 5MP を押しても、キャンセルにならない（13 は 5LP の持続の 2 フレーム目）', () => {
    for (const p of [4, 8, 12, 13]) {
      const run = play([[0, LP], [p, b(5, 'MP')]], 60, 'hit');
      const f = run.at(13).fighter;
      expect([f.move?.input, f.phase, f.frame, f.canceled], `p=${p}`).toEqual(['5LP', 'active', 1, undefined]);
      expect(run.moveInputs().includes('5MP'), `p=${p}`).toBe(false);
    }
  });
});

describe('当たる前の先行入力 (第14段階 受け入れ条件 5)', () => {
  // 2MK（0 で押す）。発生前 7 で、7 で当たり、8〜16 が止まる（ヒットストップ 9）。236HK を c で入れ終える
  const MK2 = b(2, 'MK');

  it('入れ終えたのが 4 以降（4〜6）なら、17 から 236HK が出る（canceled）', () => {
    for (const c of [4, 5, 6]) {
      const run = play([[0, MK2], ...c236(c, 'HK')], 80, 'hit');
      expect(run.at(16).fighter.move?.input, `c=${c}`).toBe('2MK');
      expect(run.at(16).fighter.frozen, `c=${c}`).toBe(true);
      const f = run.at(17).fighter;
      expect([f.move?.input, f.phase, f.frame, f.canceled], `c=${c}`).toEqual(['236HK', 'startup', 0, true]);
    }
  });

  it('3 以前に入れ終えたなら、8 の時点で古くなりすぎているので、キャンセルにならない', () => {
    // 入れ終えた 3 は、236 の 2 が frame 1（2MK を押した 0 の次）。0 より前や 0 は 2MK のボタンと重なるので使わない
    for (const c of [3]) {
      const run = play([[0, MK2], ...c236(c, 'HK')], 80, 'hit');
      expect(run.moveInputs().includes('236HK'), `c=${c}`).toBe(false);
      expect(run.at(17).fighter.move?.input, `c=${c}`).toBe('2MK');
      expect(run.frames().every((f) => f.fighter.canceled === undefined), `c=${c}`).toBe(true);
    }
  });
});

describe('必殺技キャンセルのコンボ (第14段階 受け入れ条件 6)', () => {
  it('2MK（ヒット）→ 623HK を止まっている間（8〜16）に入れると、17 から出て、23 で当たり、combo: true のダウン', () => {
    for (const c of [8, 12, 16]) {
      const run = play([[0, b(2, 'MK')], ...c623(c, 'HK')], 80, 'hit');
      const f = run.at(17).fighter;
      expect([f.move?.input, f.phase, f.frame, f.canceled], `c=${c}`).toEqual(['623HK', 'startup', 0, true]);
      const cs = run.contacts();
      expect(cs.map(([n]) => n), `c=${c}`).toEqual([7, 23]);
      expect(cs[1]![1], `c=${c}`).toEqual({ kind: 'hit', knockdown: true, combo: true, advantage: 22 });
      expect(run.at(23).dummy.phase).toBe('down');
    }
  });

  it('2MP（ヒット）→ 214LP も combo: true（2MP は 6 で当たり、7〜17 が止まる。214LP は 18 から、38 で当たる）', () => {
    const run = play([[0, b(2, 'MP')], ...c214(12, 'LP')], 90, 'hit');
    const f = run.at(18).fighter;
    expect([f.move?.input, f.canceled]).toEqual(['214LP', true]);
    const cs = run.contacts();
    expect(cs.map(([n]) => n)).toEqual([6, 38]);
    expect(cs[1]![1]).toMatchObject({ kind: 'hit', knockdown: false, combo: true });
  });
});

describe('SA キャンセル (第14段階 受け入れ条件 7)', () => {
  it('214LP（ヒット。20 で当たり、21〜33 が止まる）→ 止まっている間に 236236P を入れると、34 から出て 42 で当たり、combo: true のダウン', () => {
    for (const c of [26, 33]) {
      const run = play([...c214(0, 'LP'), ...c236236(c, 'HP')], 100, 'hit');
      expect(run.at(20).fighter.phase).toBe('active');
      expect(run.at(21).fighter.frozen).toBe(true);
      expect(run.at(33).fighter.frozen).toBe(true);
      expect(run.at(34).fighter.frozen).toBeUndefined();
      const f = run.at(34).fighter;
      expect([f.move?.input, f.phase, f.frame, f.canceled], `c=${c}`).toEqual(['236236P', 'startup', 0, true]);
      const cs = run.contacts();
      expect(cs.map(([n]) => n), `c=${c}`).toEqual([20, 42]);
      expect(cs[1]![1], `c=${c}`).toMatchObject({ kind: 'hit', knockdown: true, combo: true });
    }
  });

  it('5HK（キャンセル先なし）のヒットストップ中に 236236P を入れても、キャンセルにならない', () => {
    // 5HK は 10 で当たり、11〜23 が止まる
    // 同じ入力（236236HP）は、動ける状態で送れば 236236P が出る（入力が成立していることの確認）
    const free = play(c236236(0, 'HP'), 20, 'hit');
    expect(free.at(0).fighter.move?.input).toBe('236236P');
    const run = play([[0, b(5, 'HK')], ...c236236(20, 'HP')], 100, 'hit');
    expect(run.at(10).contact).not.toBeNull();
    expect(run.at(11).fighter.frozen).toBe(true);
    expect(run.moveInputs().includes('236236P')).toBe(false);
    expect(run.frames().every((f) => f.fighter.canceled === undefined)).toBe(true);
    expect(run.at(24).fighter.move?.input).toBe('5HK');
  });
});

describe('ガトリング（ブリジット） (第14段階 受け入れ条件 8)', () => {
  const S = b(5, 'S');

  it('5S → 2S → 2HS → 236K を、それぞれ前の技のヒットストップ中に入れると、どれも canceled で、当たるのは 6・31・55・79', () => {
    // 5S は 6 で当たり 7〜20 が止まる（14）。2S は 21 から、31 で当たり 32〜44（13）。2HS は 45 から、55 で当たり 56〜69（14）。236K は 70 から、79 で当たる
    const run = play([[0, S], [10, b(2, 'S')], [35, b(2, 'HS')], ...c236(60, 'K')], 130, 'hit', 'bridget');
    const starts: [number, string][] = [[21, '2S'], [45, '2HS'], [70, '236K']];
    for (const [n, input] of starts) {
      const f = run.at(n).fighter;
      expect([f.move?.input, f.phase, f.frame, f.canceled], input).toEqual([input, 'startup', 0, true]);
    }
    const cs = run.contacts();
    expect(cs.map(([n]) => n)).toEqual([6, 31, 55, 79]);
    expect(cs[0]![1].combo).toBe(false);
    for (const i of [1, 2, 3]) expect(cs[i]![1].combo, `i=${i}`).toBe(true);
  });

  it('5K のヒットストップ中に 2S を入れても、キャンセルにならない（5K の先にない）', () => {
    // 5K は 5 で当たり、6〜17 が止まる
    const run = play([[0, b(5, 'K')], [8, b(2, 'S')]], 80, 'hit', 'bridget');
    expect(run.at(5).contact).not.toBeNull();
    expect(run.at(6).fighter.frozen).toBe(true);
    expect(run.moveInputs().includes('2S')).toBe(false);
    expect(run.frames().every((f) => f.fighter.canceled === undefined)).toBe(true);
  });

  it('5K → 2D は 5K のガトリング先（キャンセルになる）', () => {
    const run = play([[0, b(5, 'K')], [8, b(2, 'D')]], 80, 'hit', 'bridget');
    expect(run.at(18).fighter.move?.input).toBe('2D');
    expect(run.at(18).fighter.canceled).toBe(true);
  });
});

describe('キャンセルのあとの有利 (第14段階 受け入れ条件 9)', () => {
  // 2MK（ヒット。7 で当たり、8〜16 が止まる）→ 236HK（反応のデータなし）。相手が動けるのは 38、キャラが動けるのは 236HK の終わりの 68
  const run = play([[0, b(2, 'MK')], ...c236(12, 'HK')], 90, 'hit');

  it('236HK は 17 から出る。相手が動けるのは 38', () => {
    expect(run.at(17).fighter.move?.input).toBe('236HK');
    expect(run.at(37).dummy.phase).toBe('hitstun');
    expect(run.at(38).dummy.phase).toBe('free');
  });

  it('キャンセルした所（17）では advantage を決めず、236HK の終わり（68）で -30 になる', () => {
    for (let n = 0; n <= 67; n++) expect(run.at(n).meter.advantage, `n=${n}`).toBeNull();
    expect(run.at(67).fighter.phase).toBe('recovery');
    expect(run.at(68).fighter.phase).toBe('idle');
    expect(run.at(68).meter.advantage).toBe(-30);
    expect(run.meter().advantage).toBe(-30);
  });
});

describe('メーターの印 (第14段階 受け入れ条件 10)', () => {
  it('キャンセルで技が始まったマスと、その MoveStart に cancel: true。最初の技には付かない', () => {
    const run = play([[0, b(2, 'MK')], ...c236(12, 'HK')], 90, 'hit');
    const cells = run.cells();
    expect(cells[17]!.cancel).toBe(true);
    expect(cells[17]!.moveStart).toBe(true);
    expect(cells[0]!.cancel).toBeUndefined();
    expect(cells.filter((c) => c.cancel === true)).toHaveLength(1);
    const starts = run.meter().starts;
    expect(starts.map((s) => [s.move.input, s.cancel])).toEqual([['2MK', undefined], ['236HK', true]]);
    expect(starts[1]!.index).toBe(FRAME_METER_LEAD + 17);
  });

  it('チェーン（5LP → 2LP）の 2LP には cancel が付く。動けるようになってから出た 2 つ目の技には付かない', () => {
    const run = play([[0, LP], [8, LP2]], 40, 'hit');
    expect(run.meter().starts.map((s) => [s.move.input, s.cancel])).toEqual([['5LP', undefined], ['2LP', true]]);
    // キャンセルでない（動けるようになってから出た）2 つ目の技には付かない
    const late = play([[0, LP], [22, LP2]], 50, 'hit');
    expect(late.meter().starts.map((s) => [s.move.input, s.cancel])).toEqual([['5LP', undefined], ['2LP', undefined]]);
  });

  it('止まっているマスは、キャラの段が hitstop、相手の段が hitstop', () => {
    const cells = play([[0, LP]], 40, 'hit').cells();
    for (let n = 4; n <= 12; n++) {
      expect(cells[n]!.state, `n=${n}`).toBe('hitstop');
      expect(cells[n]!.opponent, `n=${n}`).toBe('hitstop');
    }
    expect(cells[3]!.state).toBe('active');
    expect(cells[13]!.state).toBe('active');
  });

  it('FRAME_METER_MAX は 240', () => {
    expect(FRAME_METER_MAX).toBe(240);
  });
});
