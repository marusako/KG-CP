import { describe, expect, it } from 'vitest';
import { CHARACTERS } from '../src/core/characters';
import { fighterDataFor } from '../src/core/frameData';
import { INITIAL_FIGHTER, moveDisplayName, selectMove, stepFighter } from '../src/core/fighter';
import type { FighterState } from '../src/core/fighter';
import { PROFILES } from '../src/core/profiles';
import type { Direction, FrameInput } from '../src/core/types';

const fighterOf = (id: string) => ({
  data: fighterDataFor(id)!,
  character: CHARACTERS.find((c) => c.id === id)!,
});
const cammy = fighterOf('cammy');
const bridget = fighterOf('bridget');
const SF6 = PROFILES.sf6;
const GG = PROFILES.ggst;

type Spec = Direction | [Direction, string[]];
const frames = (...specs: Spec[]): FrameInput[] =>
  specs.map((s) => (Array.isArray(s) ? { dir: s[0], buttons: s[1] } : { dir: s, buttons: [] }));
const rep = (n: number, f: FrameInput): FrameInput[] => Array.from({ length: n }, () => f);
const N: FrameInput = { dir: 5, buttons: [] };

const selectC = (h: FrameInput[]) => selectMove(h, cammy.data, cammy.character, SF6)?.input ?? null;
const selectB = (h: FrameInput[]) => selectMove(h, bridget.data, bridget.character, GG)?.input ?? null;

describe('selectMove (第10段階 受け入れ条件 3)', () => {
  describe('通常技', () => {
    it('5 で LP → 5LP', () => expect(selectC(frames([5, ['LP']]))).toBe('5LP'));
    it('2 で LP → 2LP', () => expect(selectC(frames([2, ['LP']]))).toBe('2LP'));
    it('3 で LK → 2LK（斜め下はしゃがみ技）', () => expect(selectC(frames([3, ['LK']]))).toBe('2LK'));
    it('1 で LK → 2LK', () => expect(selectC(frames([1, ['LK']]))).toBe('2LK'));
    it('6 で HP → 5HP（前入れは立ち技）', () => expect(selectC(frames([6, ['HP']]))).toBe('5HP'));
    it('4 で MK → 5MK', () => expect(selectC(frames([4, ['MK']]))).toBe('5MK'));
    it('9 で LP → null（ジャンプ）', () => expect(selectC(frames([9, ['LP']]))).toBeNull());
    it('7・8 でも null', () => {
      expect(selectC(frames([7, ['LP']]))).toBeNull();
      expect(selectC(frames([8, ['LP']]))).toBeNull();
    });
    it('ボタンを押していないフレームは null', () => expect(selectC(frames(5))).toBeNull());
    it('ブリジット: 5 で P → 5P、2 で HS → 2HS、5 で HS → 5HS', () => {
      expect(selectB(frames([5, ['P']]))).toBe('5P');
      expect(selectB(frames([2, ['HS']]))).toBe('2HS');
      expect(selectB(frames([5, ['HS']]))).toBe('5HS');
    });
  });

  describe('新しく押したときだけ', () => {
    it('押しっぱなしのフレームは null', () => {
      expect(selectC(frames([5, ['LP']], [5, ['LP']]))).toBeNull();
    });
    it('離して押し直せば出る', () => {
      expect(selectC(frames([5, ['LP']], 5, [5, ['LP']]))).toBe('5LP');
    });
    it('LP を押したまま MP を足すと、MP が新しく押されたので出る', () => {
      expect(selectC(frames([5, ['LP']], [5, ['LP', 'MP']]))).toBe('5MP');
    });
    it('コマンドのボタンも押しっぱなしなら null', () => {
      expect(selectC(frames(2, 3, [6, ['LK']], [6, ['LK']]))).toBeNull();
    });
  });

  describe('必殺技・超必殺技（キャミィ）', () => {
    it('236 + LK → 236LK（5LK ではない）', () => {
      expect(selectC(frames(2, 3, [6, ['LK']]))).toBe('236LK');
    });
    it('236 + HK → 236HK', () => {
      expect(selectC(frames(2, 3, [6, ['HK']]))).toBe('236HK');
    });
    it('236236 + K → 236236K（236K ではない）', () => {
      expect(selectC(frames(2, 3, 6, 2, 3, [6, ['LK']]))).toBe('236236K');
    });
    it('236236 + P → 236236P', () => {
      expect(selectC(frames(2, 3, 6, 2, 3, [6, ['HP']]))).toBe('236236P');
    });
    it('214214 + P → 214214P', () => {
      expect(selectC(frames(2, 1, 4, 2, 1, [4, ['LP']]))).toBe('214214P');
    });
    it('623 + MK → 623MK', () => {
      expect(selectC(frames(6, 2, [3, ['MK']]))).toBe('623MK');
    });
    it('214 + HP → 214HP', () => {
      expect(selectC(frames(2, 1, [4, ['HP']]))).toBe('214HP');
    });
    it('キャミィに溜め技はないので、[4]6 の形で 6 + LP は 5LP', () => {
      expect(selectC(frames(...Array.from({ length: 40 }, () => 4 as Direction), [6, ['LP']]))).toBe('5LP');
    });
  });

  describe('必殺技・超必殺技（ブリジット。GG の 236 は手の間 [5,10]、ボタンまで 9）', () => {
    it('236 + K → 236K', () => expect(selectB(frames(2, 3, [6, ['K']]))).toBe('236K'));
    it('236 + S → 236S、236 + HS → 236HS', () => {
      expect(selectB(frames(2, 3, [6, ['S']]))).toBe('236S');
      expect(selectB(frames(2, 3, [6, ['HS']]))).toBe('236HS');
    });
    it('623 + P → 623P', () => expect(selectB(frames(6, 2, [3, ['P']]))).toBe('623P'));
    it('63214 + P → 63214P（Rock the Baby）', () => {
      expect(selectB(frames(6, 3, 2, 1, [4, ['P']]))).toBe('63214P');
    });
    it('632146 + S → 632146S', () => {
      expect(selectB(frames(6, 3, 2, 1, 4, [6, ['S']]))).toBe('632146S');
    });
    it('手の間が空きすぎた 236 は成立せず、通常技になる', () => {
      // 最初の手（2）は離す直前から数える（第8段階の決まり）ので、2 を離してから 3 までを空ける。2→3 は 7F（猶予 5F）
      const slow = [2, ...Array.from({ length: 6 }, () => 5), 3, 6].map((d) => d as Direction);
      expect(selectB(frames(...slow, [6, ['K']]))).toBe('5K');
    });
    it('ボタンが遅すぎる 236 は成立しない（ボタンまで 9 フレーム）', () => {
      const late = frames(2, 3, 6, ...Array.from({ length: 12 }, () => 6 as Direction), [6, ['K']]);
      expect(selectB(late)).toBe('5K');
    });
  });

  describe('データのない技', () => {
    it('ブリジットの 214 + S は、5S に落とさず null', () => {
      expect(selectB(frames(2, 1, [4, ['S']]))).toBeNull();
    });
    it('ブリジットの 214 + K（データなし）も null', () => {
      expect(selectB(frames(2, 1, [4, ['K']]))).toBeNull();
    });
    it('キャミィの 236 + LP（フーリガン、データなし）は null', () => {
      expect(selectC(frames(2, 3, [6, ['LP']]))).toBeNull();
    });
    it('キャミィの 214 + K（キャノンストライク、データなし）は null', () => {
      expect(selectC(frames(2, 1, [4, ['LK']]))).toBeNull();
    });
  });
});

/** history を 1 フレームずつ伸ばして stepFighter を呼び、各フレームの状態を返す */
function run(
  inputs: FrameInput[],
  opts: { fighter?: typeof cammy | null; rules?: typeof SF6; buffer?: number; start?: FighterState } = {},
): FighterState[] {
  const fighter = opts.fighter === undefined ? cammy : opts.fighter;
  const rules = opts.rules ?? SF6;
  const buffer = opts.buffer ?? 4;
  let s = opts.start ?? INITIAL_FIGHTER;
  const out: FighterState[] = [];
  const history: FrameInput[] = [];
  for (const f of inputs) {
    history.push(f);
    s = stepFighter(s, history, fighter, rules, buffer);
    out.push(s);
  }
  return out;
}
const phases = (ss: FighterState[]) => ss.map((s) => s.phase);
const seq = (...parts: [string, number][]): string[] => parts.flatMap(([p, n]) => Array.from({ length: n }, () => p));
const LP: FrameInput = { dir: 5, buttons: ['LP'] };

describe('INITIAL_FIGHTER', () => {
  it('idle で、x は 0.3、技も先行入力もない', () => {
    expect(INITIAL_FIGHTER.phase).toBe('idle');
    expect(INITIAL_FIGHTER.x).toBe(0.3);
    expect(INITIAL_FIGHTER.move).toBeNull();
    expect(INITIAL_FIGHTER.buffered).toBeNull();
  });
});

describe('stepFighter: 技 (第10段階 受け入れ条件 4)', () => {
  it('5LP: startup 3F → active 3F → recovery 7F、合計 13F で idle に戻る', () => {
    const ss = run([LP, ...rep(14, N)]);
    expect(phases(ss)).toEqual(seq(['startup', 3], ['active', 3], ['recovery', 7], ['idle', 2]));
  });

  it('押したフレームが startup の 0 フレーム目で、frame は段階の中で 0 から数える', () => {
    const ss = run([LP, ...rep(13, N)]);
    expect(ss[0]!.frame).toBe(0);
    expect(ss[0]!.move?.input).toBe('5LP');
    expect(ss.slice(0, 3).map((s) => s.frame)).toEqual([0, 1, 2]);
    expect(ss.slice(3, 6).map((s) => s.frame)).toEqual([0, 1, 2]);
    expect(ss.slice(6, 13).map((s) => s.frame)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(ss[13]!.move).toBeNull();
  });

  it('技の途中で方向を入れても、技は進み続ける', () => {
    const ss = run([LP, ...rep(5, { dir: 6, buttons: [] }), ...rep(8, N)]);
    expect(phases(ss).slice(0, 13)).toEqual(seq(['startup', 3], ['active', 3], ['recovery', 7]));
  });

  it('必殺技 236LK: コマンドが成立したフレームで startup が始まり、全体 42F', () => {
    const ss = run([...frames(2, 3, [6, ['LK']]), ...rep(45, N)]);
    expect(ss[2]!.phase).toBe('startup');
    expect(ss[2]!.frame).toBe(0);
    expect(ss[2]!.move?.input).toBe('236LK');
    const p = phases(ss);
    expect(p.slice(2, 2 + 42)).toEqual(seq(['startup', 8], ['active', 13], ['recovery', 21]));
    expect(p[2 + 42]).toBe('idle');
  });

  it('ブリジット 5P（GG のルール）: startup 7・active 2・recovery 14', () => {
    const ss = run([{ dir: 5, buttons: ['P'] }, ...rep(25, N)], { fighter: bridget, rules: GG });
    // 入力は 26 フレーム（P の 1 + ニュートラル 25）なので、終わったあとの idle は 3
    expect(phases(ss)).toEqual(seq(['startup', 7], ['active', 2], ['recovery', 14], ['idle', 3]));
  });

  it('データのない技（ブリジットの 214S）は何も出ない', () => {
    const ss = run([...frames(2, 1, [4, ['S']]), ...rep(10, N)], { fighter: bridget, rules: GG });
    expect(phases(ss).some((p) => p === 'startup' || p === 'active' || p === 'recovery')).toBe(false);
  });
});

describe('stepFighter: 先行入力 (第10段階 受け入れ条件 4)', () => {
  /** 5LP（0 フレーム目）を出し、p フレーム目にもう一度 LP を押す。13 フレーム目が最初に動けるフレーム */
  const withSecondPress = (p: number) => {
    const inputs: FrameInput[] = [LP, ...rep(20, N)];
    inputs[p] = LP;
    return run(inputs);
  };

  it('残りが inputBuffer ちょうど（4F 前）に押したものは、動けるようになった最初のフレームで出る', () => {
    const ss = withSecondPress(9);
    expect(ss[12]!.phase).toBe('recovery');
    expect(ss[13]!.phase).toBe('startup');
    expect(ss[13]!.frame).toBe(0);
    expect(ss[13]!.move?.input).toBe('5LP');
  });

  it('inputBuffer を 1F 超えて早く押したものは出ない', () => {
    const ss = withSecondPress(8);
    expect(ss[13]!.phase).toBe('idle');
    expect(phases(ss).slice(13).every((p) => p === 'idle')).toBe(true);
  });

  it('動けるようになる直前（recovery の最後）に押したものも出る', () => {
    const ss = withSecondPress(12);
    expect(ss[13]!.phase).toBe('startup');
  });

  it('途中で押すと buffered に入り、出たあとは空になる', () => {
    const ss = withSecondPress(10);
    expect(ss[10]!.buffered).not.toBeNull();
    expect(ss[10]!.buffered?.move.input).toBe('5LP');
    expect(ss[13]!.buffered).toBeNull();
  });

  it('inputBuffer の値に従う（0 なら、前に押したものは出ない）', () => {
    const inputs: FrameInput[] = [LP, ...rep(20, N)];
    inputs[12] = LP;
    expect(run(inputs, { buffer: 0 })[13]!.phase).toBe('idle');
  });

  it('inputBuffer が 10 なら、10F 前に押したものまで出る。11F 前は出ない', () => {
    const a: FrameInput[] = [LP, ...rep(20, N)];
    a[3] = LP;
    const b: FrameInput[] = [LP, ...rep(20, N)];
    b[2] = LP;
    expect(run(a, { buffer: 10 })[13]!.phase).toBe('startup');
    expect(run(b, { buffer: 10 })[13]!.phase).toBe('idle');
  });
});

describe('stepFighter: 歩き・しゃがみ (第10段階 受け入れ条件 4)', () => {
  it('5 は idle、2 は crouch、6 は walkForward、4 は walkBack', () => {
    expect(run([N])[0]!.phase).toBe('idle');
    expect(run([{ dir: 2, buttons: [] }])[0]!.phase).toBe('crouch');
    expect(run([{ dir: 6, buttons: [] }])[0]!.phase).toBe('walkForward');
    expect(run([{ dir: 4, buttons: [] }])[0]!.phase).toBe('walkBack');
  });

  it('離すと idle に戻り、位置は動かない', () => {
    const ss = run([...rep(5, { dir: 6, buttons: [] }), ...rep(5, N)]);
    expect(ss[5]!.phase).toBe('idle');
    expect(ss[9]!.x).toBe(ss[5]!.x);
  });

  it('前歩きで x が増え、後ろ歩きで x が減る', () => {
    const f = run(rep(10, { dir: 6, buttons: [] }));
    for (let i = 1; i < f.length; i++) expect(f[i]!.x).toBeGreaterThan(f[i - 1]!.x);
    expect(f[0]!.x).toBeGreaterThan(INITIAL_FIGHTER.x);
    const b = run(rep(10, { dir: 4, buttons: [] }));
    for (let i = 1; i < b.length; i++) expect(b[i]!.x).toBeLessThan(b[i - 1]!.x);
    expect(b[0]!.x).toBeLessThan(INITIAL_FIGHTER.x);
  });

  it('1 フレームの移動量は一定', () => {
    const f = run(rep(6, { dir: 6, buttons: [] }));
    const d = f[1]!.x - f[0]!.x;
    for (let i = 2; i < f.length; i++) expect(f[i]!.x - f[i - 1]!.x).toBeCloseTo(d, 9);
  });

  it('右端（0.95）で止まり、超えない', () => {
    const f = run(rep(3000, { dir: 6, buttons: [] }));
    const last = f[f.length - 1]!;
    expect(last.x).toBeCloseTo(0.95, 9);
    expect(Math.max(...f.map((s) => s.x))).toBeLessThanOrEqual(0.95 + 1e-9);
    expect(f[f.length - 2]!.x).toBe(last.x);
  });

  it('左端（0.05）で止まり、下回らない', () => {
    const f = run(rep(3000, { dir: 4, buttons: [] }));
    const last = f[f.length - 1]!;
    expect(last.x).toBeCloseTo(0.05, 9);
    expect(Math.min(...f.map((s) => s.x))).toBeGreaterThanOrEqual(0.05 - 1e-9);
    expect(f[f.length - 2]!.x).toBe(last.x);
  });

  it('端で止まっていても、逆に歩けばすぐ動き出す', () => {
    const f = run([...rep(3000, { dir: 6, buttons: [] }), { dir: 4, buttons: [] }]);
    expect(f[3000]!.x).toBeLessThan(f[2999]!.x);
  });
});

describe('stepFighter: ジャンプ (第10段階 受け入れ条件 4)', () => {
  const up: FrameInput = { dir: 8, buttons: [] };

  it('キャミィ: prejump 4F → air 38F → landing 3F → idle（合計 45F）', () => {
    const ss = run([up, ...rep(50, N)]);
    expect(phases(ss).slice(0, 46)).toEqual(seq(['prejump', 4], ['air', 38], ['landing', 3], ['idle', 1]));
  });

  it('frame は段階ごとに 0 から数える', () => {
    const ss = run([up, ...rep(50, N)]);
    expect(ss.slice(0, 4).map((s) => s.frame)).toEqual([0, 1, 2, 3]);
    expect(ss[4]!.frame).toBe(0);
    expect(ss[41]!.frame).toBe(37);
    expect(ss[42]!.frame).toBe(0);
  });

  it('ブリジット: prejump 4F → air 31F → landing 6F', () => {
    const ss = run([up, ...rep(50, N)], { fighter: bridget, rules: GG });
    expect(phases(ss).slice(0, 42)).toEqual(seq(['prejump', 4], ['air', 31], ['landing', 6], ['idle', 1]));
  });

  it('ジャンプの向き: 7 は -1、8 は 0、9 は 1', () => {
    expect(run([{ dir: 7, buttons: [] }, N])[1]!.jumpDir).toBe(-1);
    expect(run([up, N])[1]!.jumpDir).toBe(0);
    expect(run([{ dir: 9, buttons: [] }, N])[1]!.jumpDir).toBe(1);
  });

  it('前ジャンプでは空中で x が増え、後ろジャンプでは減る', () => {
    const fwd = run([{ dir: 9, buttons: [] }, ...rep(45, N)]);
    expect(fwd[41]!.x).toBeGreaterThan(fwd[3]!.x);
    const back = run([{ dir: 7, buttons: [] }, ...rep(45, N)]);
    expect(back[41]!.x).toBeLessThan(back[3]!.x);
  });

  it('垂直ジャンプでは x が変わらない', () => {
    const ss = run([up, ...rep(45, N)]);
    expect(ss[44]!.x).toBe(INITIAL_FIGHTER.x);
  });

  it('空中ではボタンを無視する（先行入力にも入らず、着地後に技は出ない）', () => {
    const inputs: FrameInput[] = [up, ...rep(50, N)];
    inputs[10] = LP;
    inputs[30] = LP;
    const ss = run(inputs);
    expect(ss[10]!.phase).toBe('air');
    expect(ss[10]!.buffered).toBeNull();
    expect(phases(ss).some((p) => p === 'startup' || p === 'active' || p === 'recovery')).toBe(false);
    expect(ss[45]!.phase).toBe('idle');
  });

  it('着地中に押したボタンは先行入力になり、動けるようになった最初のフレームで出る', () => {
    const inputs: FrameInput[] = [up, ...rep(50, N)];
    inputs[43] = LP;
    const ss = run(inputs);
    expect(ss[43]!.phase).toBe('landing');
    expect(ss[43]!.buffered).not.toBeNull();
    expect(ss[45]!.phase).toBe('startup');
    expect(ss[45]!.frame).toBe(0);
  });

  it('prejump 中に押したボタンも、通常技は選ばれない（ジャンプのまま）', () => {
    const ss = run([{ dir: 8, buttons: [] }, { dir: 8, buttons: ['LP'] }, ...rep(48, N)]);
    expect(ss[1]!.phase).toBe('prejump');
    expect(ss[4]!.phase).toBe('air');
  });
});

describe('stepFighter: キャラなし (第10段階 受け入れ条件 4)', () => {
  it('ボタンを押しても技は出ず、idle のまま', () => {
    const ss = run([LP, ...rep(5, N)], { fighter: null });
    expect(phases(ss).every((p) => p === 'idle')).toBe(true);
    expect(ss.every((s) => s.move === null)).toBe(true);
  });

  it('コマンドを入れても技は出ない', () => {
    const ss = run([...frames(2, 3, [6, ['LK']]), ...rep(10, N)], { fighter: null });
    expect(phases(ss).some((p) => p === 'startup' || p === 'active' || p === 'recovery')).toBe(false);
  });

  it('歩き・しゃがみ・ジャンプはできる（ジャンプはキャミィと同じ 4・38・3）', () => {
    expect(run([{ dir: 6, buttons: [] }], { fighter: null })[0]!.phase).toBe('walkForward');
    expect(run([{ dir: 2, buttons: [] }], { fighter: null })[0]!.phase).toBe('crouch');
    const ss = run([{ dir: 8, buttons: [] }, ...rep(50, N)], { fighter: null });
    expect(phases(ss).slice(0, 46)).toEqual(seq(['prejump', 4], ['air', 38], ['landing', 3], ['idle', 1]));
  });
});


describe('moveDisplayName: 技名を選んだ言語で出す（ユーザーの要望で追加）', () => {
  const cammy = CHARACTERS.find((c) => c.id === 'cammy')!;
  const bridget = CHARACTERS.find((c) => c.id === 'bridget')!;
  const cData = fighterDataFor('cammy')!;
  const bData = fighterDataFor('bridget')!;
  const mv = (d: typeof cData, input: string) => d.moves.find((m) => m.input === input)!;

  it('通常技は「立ち／しゃがみ」とボタン。スト6 の日本語は弱・中・強で書く', () => {
    expect(moveDisplayName(mv(cData, '5LP'), cammy, PROFILES.sf6, 'ja')).toBe('立ち弱P (5LP)');
    expect(moveDisplayName(mv(cData, '2LK'), cammy, PROFILES.sf6, 'ja')).toBe('しゃがみ弱K (2LK)');
    expect(moveDisplayName(mv(cData, '5HK'), cammy, PROFILES.sf6, 'ja')).toBe('立ち強K (5HK)');
    expect(moveDisplayName(mv(cData, '5LP'), cammy, PROFILES.sf6, 'en')).toBe('Standing LP (5LP)');
    expect(moveDisplayName(mv(cData, '2MK'), cammy, PROFILES.sf6, 'en')).toBe('Crouching MK (2MK)');
  });

  it('GG の通常技はボタン名のまま', () => {
    expect(moveDisplayName(mv(bData, '5HS'), bridget, PROFILES.ggst, 'ja')).toBe('立ちHS (5HS)');
    expect(moveDisplayName(mv(bData, '2D'), bridget, PROFILES.ggst, 'en')).toBe('Crouching D (2D)');
  });

  it('必殺技・超必殺技は、キャラのデータの技名（言語に合わせる）', () => {
    expect(moveDisplayName(mv(cData, '236LK'), cammy, PROFILES.sf6, 'ja')).toBe('スパイラルアロー (236LK)');
    expect(moveDisplayName(mv(cData, '236LK'), cammy, PROFILES.sf6, 'en')).toBe('Spiral Arrow (236LK)');
    expect(moveDisplayName(mv(cData, '214HP'), cammy, PROFILES.sf6, 'ja')).toBe('アクセルスピンナックル (214HP)');
    expect(moveDisplayName(mv(cData, '214HP'), cammy, PROFILES.sf6, 'en')).toBe('Quick Spin Knuckle (214HP)');
    expect(moveDisplayName(mv(cData, '236236K'), cammy, PROFILES.sf6, 'ja')).toBe('スピンドライブスマッシャー (236236K)');
  });

  it('ブリジットの必殺技も、日本語では日本語名、英語では英語名', () => {
    expect(moveDisplayName(mv(bData, '236HS'), bridget, PROFILES.ggst, 'ja')).toBe('ストップ＆ダッシュ（236版） (236HS)');
    expect(moveDisplayName(mv(bData, '63214P'), bridget, PROFILES.ggst, 'ja')).toBe('ロック ザ ベイビー (63214P)');
    expect(moveDisplayName(mv(bData, '236K'), bridget, PROFILES.ggst, 'ja')).toBe('キックスタート マイ ハート (236K)');
    expect(moveDisplayName(mv(bData, '236K'), bridget, PROFILES.ggst, 'en')).toBe('Kick Start My Heart (236K)');
  });
});
