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
  it('idle で、技も先行入力もない', () => {
    expect(INITIAL_FIGHTER.phase).toBe('idle');
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

  it('離すと idle に戻る', () => {
    const ss = run([...rep(5, { dir: 6, buttons: [] }), ...rep(5, N)]);
    expect(ss[4]!.phase).toBe('walkForward');
    expect(ss[5]!.phase).toBe('idle');
    expect(ss[9]!.phase).toBe('idle');
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

describe('stepFighter: 当たったときの硬直 (第13段階 受け入れ条件 3)', () => {
  const HK: FrameInput = { dir: 5, buttons: ['HK'] };

  /**
   * 技の持続の 1 フレーム目（hitFrame）で、stepDummy がするのと同じ印（contact: true）を付けて進める。
   * hitFrame を null にすると空振り
   */
  function runWithContact(inputs: FrameInput[], hitFrame: number | null): FighterState[] {
    let s: FighterState = INITIAL_FIGHTER;
    const history: FrameInput[] = [];
    const out: FighterState[] = [];
    inputs.forEach((f, i) => {
      history.push(f);
      s = stepFighter(s, history, cammy, SF6, 4);
      if (i === hitFrame) s = { ...s, contact: true };
      out.push(s);
    });
    return out;
  }

  it('5HK が当たると硬直は 19: 発生前 10 + 持続 3 + 硬直 19 = 32 フレーム目に idle', () => {
    const ss = runWithContact([HK, ...rep(40, N)], 10);
    expect(phases(ss)).toEqual(seq(['startup', 10], ['active', 3], ['recovery', 19], ['idle', 9]));
  });

  it('5HK が空振りなら硬直は 21: 10 + 3 + 21 = 34 フレーム目に idle', () => {
    const ss = runWithContact([HK, ...rep(40, N)], null);
    expect(phases(ss)).toEqual(seq(['startup', 10], ['active', 3], ['recovery', 21], ['idle', 7]));
  });

  it('2MP が当たると硬直は 14（空振りは 17）: 6 + 3 + 14 = 23 フレーム目に idle', () => {
    const MP2: FrameInput = { dir: 2, buttons: ['MP'] };
    const hit = runWithContact([MP2, ...rep(30, N)], 6);
    expect(phases(hit)).toEqual(seq(['startup', 6], ['active', 3], ['recovery', 14], ['idle', 8]));
    const miss = runWithContact([MP2, ...rep(30, N)], null);
    expect(phases(miss)).toEqual(seq(['startup', 6], ['active', 3], ['recovery', 17], ['idle', 5]));
  });

  it('当たったときの硬直が空振りと同じ技（5LP）は、当たっても硬直 7 のまま', () => {
    const ss = runWithContact([LP, ...rep(20, N)], 3);
    expect(phases(ss)).toEqual(seq(['startup', 3], ['active', 3], ['recovery', 7], ['idle', 8]));
  });

  it('contact の印は、新しい技を出すと消える（印が付いていない状態で次の技が始まる）', () => {
    // 5LP（0 で押す）に contact を付け、13 に 5LP をもう一度押す
    const inputs: FrameInput[] = [LP, ...rep(30, N)];
    inputs[13] = LP;
    const ss = runWithContact(inputs, 3);
    expect(ss[12]!.contact).toBe(true);
    expect(ss[13]!.move?.input).toBe('5LP');
    expect(ss[13]!.phase).toBe('startup');
    expect(ss[13]!.contact).toBeUndefined();
    expect(ss[16]!.phase).toBe('active');
    expect(ss[16]!.contact).toBeUndefined();
  });

  it('stepFighter だけでは contact は付かない（付けるのは相手）', () => {
    const ss = run([HK, ...rep(40, N)]);
    expect(ss.every((s) => s.contact === undefined)).toBe(true);
  });
});

describe('stepFighter: ヒットストップとキャンセル (第14段階 受け入れ条件 2〜4)', () => {
  const LP2: FrameInput = { dir: 2, buttons: ['LP'] };
  const MP: FrameInput = { dir: 5, buttons: ['MP'] };

  /**
   * 5LP を 0 で押す。hit が数なら、その持続の 1 フレーム目で stepDummy がするのと同じ印
   * （contact: true と hitstop）を付けて進める。null なら空振り。
   * 5LP の持続の 1 フレーム目は 3、ヒットストップ 9 は 4〜12 のあいだ
   */
  function runHit(presses: Record<number, FrameInput>, hit: { frame: number; hitstop: number } | null, length = 40): FighterState[] {
    let s: FighterState = INITIAL_FIGHTER;
    const history: FrameInput[] = [];
    const out: FighterState[] = [];
    for (let i = 0; i < length; i++) {
      history.push(i === 0 ? LP : (presses[i] ?? N));
      s = stepFighter(s, history, cammy, SF6, 4);
      if (hit !== null && i === hit.frame) s = { ...s, contact: true, hitstop: hit.hitstop };
      out.push(s);
    }
    return out;
  }
  const HIT = { frame: 3, hitstop: 9 };

  it('hitstop があるあいだ、phase・frame・move は変わらず、frozen: true。hitstop は 1 ずつ減り、0 で消える', () => {
    const ss = runHit({}, HIT);
    expect(ss[3]!.hitstop).toBe(9);
    for (let i = 4; i <= 12; i++) {
      expect(ss[i]!.phase, `i=${i}`).toBe('active');
      expect(ss[i]!.frame, `i=${i}`).toBe(0);
      expect(ss[i]!.move?.input, `i=${i}`).toBe('5LP');
      expect(ss[i]!.frozen, `i=${i}`).toBe(true);
      expect(ss[i]!.contact, `i=${i}`).toBe(true);
    }
    expect(ss[4]!.hitstop).toBe(8);
    expect(ss[11]!.hitstop).toBe(1);
    expect(ss[12]!.hitstop).toBeUndefined();
  });

  it('止まっていないフレーム（0〜3 と 13 以降）には frozen を付けない。止まり終わったあとは続きから進む', () => {
    const ss = runHit({}, HIT);
    for (const i of [0, 1, 2, 3, 13, 14, 15, 21, 22, 30]) expect(ss[i]!.frozen, `i=${i}`).toBeUndefined();
    expect(ss.slice(13, 15).map((s) => [s.phase, s.frame])).toEqual([['active', 1], ['active', 2]]);
    expect(ss.slice(15, 22).map((s) => [s.phase, s.frame])).toEqual(
      [0, 1, 2, 3, 4, 5, 6].map((f) => ['recovery', f]),
    );
    expect(ss[22]!.phase).toBe('idle');
  });

  it('hitstop がなければ（当たっていなければ）止まらない', () => {
    const ss = runHit({}, null);
    expect(ss.every((s) => s.frozen === undefined)).toBe(true);
    expect(phases(ss).slice(0, 13)).toEqual(seq(['startup', 3], ['active', 3], ['recovery', 7]));
  });

  it('止まっている間に押したキャンセル先（2LP）は、先行入力に入り、予約（cancelTo）になる。止まり終わった 13 から出る', () => {
    const ss = runHit({ 8: LP2 }, HIT);
    expect(ss[8]!.buffered?.move.input).toBe('2LP');
    expect(ss[8]!.cancelTo?.input).toBe('2LP');
    expect(ss[12]!.cancelTo?.input).toBe('2LP');
    expect(ss[12]!.phase).toBe('active');
    expect(ss[13]!.phase).toBe('startup');
    expect(ss[13]!.frame).toBe(0);
    expect(ss[13]!.move?.input).toBe('2LP');
    expect(ss[13]!.canceled).toBe(true);
    expect(ss[13]!.contact).toBeUndefined();
    expect(ss[13]!.cancelTo).toBeUndefined();
    expect(ss[13]!.frozen).toBeUndefined();
  });

  it('予約はあとから押したキャンセル先で置き換わる（6 に 2LP、10 に 2LK → 2LK が出る）', () => {
    const LK2: FrameInput = { dir: 2, buttons: ['LK'] };
    const ss = runHit({ 6: LP2, 10: LK2 }, HIT);
    expect(ss[6]!.cancelTo?.input).toBe('2LP');
    expect(ss[10]!.cancelTo?.input).toBe('2LK');
    expect(ss[13]!.move?.input).toBe('2LK');
    expect(ss[13]!.canceled).toBe(true);
  });

  it('止まっている間は、4〜12 のどこで押しても 13 から出る', () => {
    for (let p = 4; p <= 12; p++) {
      const ss = runHit({ [p]: LP2 }, HIT);
      expect(ss[13]!.move?.input, `p=${p}`).toBe('2LP');
      expect(ss[13]!.phase, `p=${p}`).toBe('startup');
      expect(ss[13]!.canceled, `p=${p}`).toBe(true);
    }
  });

  it('止まり終わったあとの窓: 13・14（持続）・15（硬直の 0 フレーム目）に押すと、そのフレームから出る', () => {
    for (const p of [13, 14, 15]) {
      const ss = runHit({ [p]: LP2 }, HIT);
      expect(ss[p]!.phase, `p=${p}`).toBe('startup');
      expect(ss[p]!.frame, `p=${p}`).toBe(0);
      expect(ss[p]!.move?.input, `p=${p}`).toBe('2LP');
      expect(ss[p]!.canceled, `p=${p}`).toBe(true);
      expect(ss[p]!.contact, `p=${p}`).toBeUndefined();
    }
  });

  it('16 に押すとキャンセルにならない（16 は硬直のまま）。先行入力にも間に合わず、2LP は出ない', () => {
    const ss = runHit({ 16: LP2 }, HIT);
    expect(ss[16]!.phase).toBe('recovery');
    expect(ss[16]!.move?.input).toBe('5LP');
    expect(ss[16]!.canceled).toBeUndefined();
    expect(ss.some((s) => s.move?.input === '2LP')).toBe(false);
  });

  it('当たっていなければ（contact なし）、持続の間に押してもキャンセルにならない', () => {
    const ss = runHit({ 5: LP2 }, null);
    expect(ss[5]!.phase).toBe('active'); // 空振りは止まらない。5LP は 6 から硬直、13 から動ける
    expect(ss[5]!.move?.input).toBe('5LP');
    expect(ss[5]!.canceled).toBeUndefined();
    expect(ss.every((s) => s.canceled === undefined)).toBe(true);
    expect(ss.some((s) => s.move?.input === '2LP')).toBe(false); // 5 に押したものは 13 では age 8 > 4 で捨てられ、出ない
    // 9 以降に押した先行入力（age 4 以内）なら、通常どおり動けるようになった 13 に出る（キャンセルではない）
    const buf = runHit({ 9: LP2 }, null);
    expect(buf[13]!.move?.input).toBe('2LP');
    expect(buf[13]!.canceled).toBeUndefined();
  });

  it('キャンセル先でない技（5MP）は予約にならない。止まり終わった 13 は 5LP の持続の 2 フレーム目のまま', () => {
    for (const p of [4, 8, 12, 13]) {
      const ss = runHit({ [p]: MP }, HIT);
      expect(ss[Math.min(p, 12)]!.cancelTo, `p=${p}`).toBeUndefined();
      expect(ss[13]!.phase, `p=${p}`).toBe('active');
      expect(ss[13]!.frame, `p=${p}`).toBe(1);
      expect(ss[13]!.move?.input, `p=${p}`).toBe('5LP');
      expect(ss.every((s) => s.canceled === undefined), `p=${p}`).toBe(true);
    }
  });

  it('キャンセル先でない技は、今までどおり先行入力（硬直が終わってから出る）。8 に押すと古くなって出ない', () => {
    // 19 に押すと、動けるようになる 22 で 3 フレーム前。出る（キャンセルではない）
    const late = runHit({ 19: MP }, HIT);
    expect(late[19]!.buffered?.move.input).toBe('5MP');
    expect(late[22]!.phase).toBe('startup');
    expect(late[22]!.move?.input).toBe('5MP');
    expect(late[22]!.canceled).toBeUndefined();
    const early = runHit({ 8: MP }, HIT);
    expect(early.some((s) => s.move?.input === '5MP')).toBe(false);
  });

  it('canceled は、キャンセルで出した技のあいだ付き、動けるようになると消える', () => {
    const ss = runHit({ 8: LP2 }, HIT, 50);
    // 2LP は 13 から 13 フレーム（3 + 2 + 8）。26 から idle
    for (let i = 13; i <= 25; i++) expect(ss[i]!.canceled, `i=${i}`).toBe(true);
    expect(ss[26]!.phase).toBe('idle');
    expect(ss[26]!.canceled).toBeUndefined();
  });

  it('canceled は、次に（キャンセルでなく）新しい技を出すと消える', () => {
    // 2LP をキャンセルで出し、27 に 5LP（動ける）
    const ss = runHit({ 8: LP2, 27: LP }, HIT, 50);
    expect(ss[27]!.move?.input).toBe('5LP');
    expect(ss[27]!.canceled).toBeUndefined();
  });

  it('必殺技へのキャンセルも出る（5LP のヒットストップ中に 236LK を入れ終える → 13 から 236LK）', () => {
    // 236 + LK を 6・7・8 で入れる
    const ss = runHit({ 6: { dir: 2, buttons: [] }, 7: { dir: 3, buttons: [] }, 8: { dir: 6, buttons: ['LK'] } }, HIT);
    expect(ss[13]!.move?.input).toBe('236LK');
    expect(ss[13]!.canceled).toBe(true);
  });
});
