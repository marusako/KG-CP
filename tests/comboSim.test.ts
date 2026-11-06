// 第15段階 受け入れ条件 1〜3: コンボトライアルを「相手に当たってつながったか」で判定する。
// 条件 2・3 は、本物の stepFighter・stepDummy で毎フレーム進めて SimFrame を作り、stepSimTrial に渡して確かめる。
// フレームは、1 手目のボタンを押したフレームを 0 とする（inputBuffer = 4、相手は 'hit'）。
import { describe, expect, it } from 'vitest';
import { CHARACTERS, comboToRecipe } from '../src/core/characters';
import type { CharacterData } from '../src/core/characters';
import { parseRecipe } from '../src/core/combo';
import type { ComboRecipe } from '../src/core/combo';
import { initialSimTrial, moveMatchesStep, resolveRecipe, stepSimTrial } from '../src/core/comboSim';
import type { SimFrame, SimTrialEvent } from '../src/core/comboSim';
import { GG_RULES, SF6_RULES } from '../src/core/commands';
import { INITIAL_DUMMY, stepDummy } from '../src/core/dummy';
import type { DummyState } from '../src/core/dummy';
import { INITIAL_FIGHTER, stepFighter } from '../src/core/fighter';
import type { FighterState } from '../src/core/fighter';
import { fighterDataFor } from '../src/core/frameData';
import type { FighterData, MoveFrames } from '../src/core/frameData';
import { parseStep } from '../src/core/notation';
import type { NotationRules } from '../src/core/notation';
import { PROFILES } from '../src/core/profiles';
import type { FrameInput } from '../src/core/types';

const INPUT_BUFFER = 4;

const who = {
  cammy: {
    c: { data: fighterDataFor('cammy')!, character: CHARACTERS.find((c) => c.id === 'cammy')! },
    rules: SF6_RULES,
  },
  bridget: {
    c: { data: fighterDataFor('bridget')!, character: CHARACTERS.find((c) => c.id === 'bridget')! },
    rules: GG_RULES,
  },
};
type Who = keyof typeof who;

const N: FrameInput = { dir: 5, buttons: [] };
const b = (dir: FrameInput['dir'], ...buttons: string[]): FrameInput => ({ dir, buttons });
type Entries = [number, FrameInput][];
const c236 = (f: number, btn: string): Entries => [[f - 2, b(2)], [f - 1, b(3)], [f, b(6, btn)]];
const c623 = (f: number, btn: string): Entries => [[f - 2, b(6)], [f - 1, b(2)], [f, b(3, btn)]];
const c214 = (f: number, btn: string): Entries => [[f - 2, b(2)], [f - 1, b(1)], [f, b(4, btn)]];

/** レシピの表記の並びから ComboRecipe を作る（2 手目からの window は新しい判定では使わないので、仮の値） */
function recipeOf(texts: string[], rules: NotationRules): ComboRecipe {
  const r = parseRecipe(
    { id: 'r', name: 'r', steps: texts.map((input, i) => (i === 0 ? { input } : { input, window: [0, 15] })) },
    rules,
  );
  if (!r.ok) throw new Error(`レシピが読めません: ${r.error}`);
  return r.recipe;
}

const ORIGIN = 20; // 1 手目の前の free の長さ。frame n の入力は inputs[ORIGIN + n]

interface RunOpts {
  who?: Who;
  dummy?: DummyState;
}

/** 本物の stepFighter・stepDummy で進めて、毎フレーム stepSimTrial に渡す。events の frame は 1 手目のボタンを 0 としたもの */
function run(texts: string[], entries: Entries, length: number, opts: RunOpts = {}) {
  const { c, rules } = who[opts.who ?? 'cammy'];
  const moves = resolveRecipe(recipeOf(texts, rules), c.data, rules);
  if (moves === null) throw new Error('resolveRecipe が null です');
  const inputs: FrameInput[] = Array.from({ length: ORIGIN + length }, () => N);
  for (const [f, input] of entries) inputs[ORIGIN + f] = input;

  let fighter: FighterState = INITIAL_FIGHTER;
  let dummy: DummyState = opts.dummy ?? INITIAL_DUMMY;
  let state = initialSimTrial();
  const history: FrameInput[] = [];
  const events: [number, SimTrialEvent][] = [];
  const stepIndexes: number[] = [];
  const contactFrames: number[] = [];
  inputs.forEach((input, i) => {
    history.push(input);
    const stepped = stepFighter(fighter, history, c, rules, INPUT_BUFFER);
    const r = stepDummy(dummy, stepped, 'hit');
    const sim: SimFrame = {
      frame: i,
      before: fighter,
      after: r.fighter,
      dummyBefore: dummy,
      dummyAfter: r.dummy,
      contact: r.contact,
    };
    const out = stepSimTrial(state, moves, sim, INPUT_BUFFER);
    state = out.state;
    if (out.event) events.push([i - ORIGIN, out.event]);
    if (r.contact) contactFrames.push(i - ORIGIN);
    stepIndexes.push(state.stepIndex);
    fighter = r.fighter;
    dummy = r.dummy;
  });
  return {
    events,
    contactFrames,
    /** frame n の処理が終わったあとの stepIndex */
    stepIndexAt: (n: number) => stepIndexes[ORIGIN + n]!,
    finalStepIndex: () => stepIndexes[stepIndexes.length - 1]!,
  };
}

const hit = (stepIndex: number, timing: { offset: number; window: number } | null = null): SimTrialEvent => ({
  type: 'hit',
  stepIndex,
  timing,
});
const complete = (stepIndex: number, timing: { offset: number; window: number } | null = null): SimTrialEvent => ({
  type: 'complete',
  stepIndex,
  timing,
});
const drop = (stepIndex: number, reason: 'early' | 'late' | 'wrong', frames: number | null): SimTrialEvent => ({
  type: 'drop',
  stepIndex,
  reason,
  frames,
});

// ---------------------------------------------------------------- 受け入れ条件 1

const cammy = who.cammy;
const bridget = who.bridget;
const mv = (data: FighterData, input: string): MoveFrames => {
  const m = data.moves.find((x) => x.input === input);
  if (!m) throw new Error(`${data.characterId} に ${input} がありません`);
  return m;
};
const stepOf = (text: string, rules: NotationRules) => {
  const r = parseStep(text, rules);
  if (!r.ok) throw new Error(`読めない表記: ${text}`);
  return r.input;
};
const inputsOf = (moves: readonly (readonly MoveFrames[])[] | null) => moves?.map((list) => list.map((m) => m.input));

describe('moveMatchesStep (第15段階 受け入れ条件 1)', () => {
  const sf = (step: string, move: string) => moveMatchesStep(mv(cammy.c.data, move), stepOf(step, SF6_RULES), SF6_RULES);
  const gg = (step: string, move: string) => moveMatchesStep(mv(bridget.c.data, move), stepOf(step, GG_RULES), GG_RULES);

  it('通常技: 方向（5 か 2）とボタンが合う技だけ', () => {
    expect(sf('5LP', '5LP')).toBe(true);
    expect(sf('2LP', '2LP')).toBe(true);
    expect(sf('2LP', '5LP')).toBe(false); // 方向が違う
    expect(sf('5LP', '2LP')).toBe(false);
    expect(sf('5LP', '5MP')).toBe(false); // ボタンが違う
    expect(sf('5LP', '5LK')).toBe(false);
    expect(sf('2MK', '2MK')).toBe(true);
    expect(sf('5LP', '236HK')).toBe(false);
  });

  it('コマンド: 方向の表記が同じで、ボタンが合う技', () => {
    expect(sf('236HK', '236HK')).toBe(true);
    expect(sf('236HK', '236LK')).toBe(false); // ボタンが違う
    expect(sf('623HK', '623HK')).toBe(true);
    expect(sf('623HK', '236HK')).toBe(false); // 方向の表記が違う
    expect(sf('214LP', '214LP')).toBe(true);
    expect(sf('214LP', '214MP')).toBe(false);
    expect(sf('236HK', '5LP')).toBe(false);
  });

  it('スト6 の P は LP・MP・HP のどれでもよい（214P は 214LP・214MP・214HP に当たる）', () => {
    for (const m of ['214LP', '214MP', '214HP']) expect(sf('214P', m), m).toBe(true);
    expect(sf('214P', '623HK')).toBe(false);
    expect(sf('214P', '236HK')).toBe(false);
  });

  it('GG: 5S は c.S（第20段階で 5S を近S にした）だけ（5HS は別のボタン）、2HS は 2HS だけ、236K は 236K', () => {
    expect(gg('5S', 'c.S')).toBe(true);
    expect(gg('5S', '5HS')).toBe(false);
    expect(gg('2S', '2S')).toBe(true);
    expect(gg('2S', '2HS')).toBe(false);
    expect(gg('2HS', '2HS')).toBe(true);
    expect(gg('2HS', '2S')).toBe(false);
    expect(gg('2S', 'c.S')).toBe(false);
    expect(gg('236K', '236K')).toBe(true);
    expect(gg('236K', '236S')).toBe(false);
  });
});

describe('resolveRecipe (第15段階 受け入れ条件 1)', () => {
  it('キャミィのコンボ 1〜3 は決まり、手ごとの技の一覧は手の表記どおり', () => {
    const expected: Record<string, string[][]> = {
      'cammy-combo-1': [['2LK'], ['2LP'], ['623HK']],
      'cammy-combo-2': [['2HP'], ['2MP'], ['236HK']],
      'cammy-combo-3': [['2MP'], ['214LP']],
    };
    const ch = CHARACTERS.find((x) => x.id === 'cammy') as CharacterData;
    expect(ch.combos.map((x) => x.id)).toEqual(Object.keys(expected));
    for (const combo of ch.combos) {
      const recipe = comboToRecipe(combo, PROFILES.sf6);
      expect(recipe, combo.id).not.toBeNull();
      const moves = resolveRecipe(recipe!, cammy.c.data, SF6_RULES);
      expect(moves, combo.id).not.toBeNull();
      expect(inputsOf(moves), combo.id).toEqual(expected[combo.id]);
    }
  });

  it('ブリジットのコンボ（c.S → 2S → 2HS → 236K）は決まる', () => {
    const ch = CHARACTERS.find((x) => x.id === 'bridget') as CharacterData;
    const recipe = comboToRecipe(ch.combos[0]!, PROFILES.ggst)!;
    const moves = resolveRecipe(recipe, bridget.c.data, GG_RULES);
    expect(inputsOf(moves)).toEqual([['c.S'], ['2S'], ['2HS'], ['236K']]);
  });

  it('手が P のまとめ書きなら、LP・MP・HP のうちデータにある技がすべて入る（214P）', () => {
    const moves = resolveRecipe(recipeOf(['5LP', '214P'], SF6_RULES), cammy.c.data, SF6_RULES);
    expect(inputsOf(moves)).toEqual([['5LP'], ['214LP', '214MP', '214HP']]);
  });

  it('236P の手には、236LP・236MP・236HP の技があれば当たる（スト6 の P）', () => {
    const mk = (input: string): MoveFrames => ({
      input,
      startup: 10,
      active: 3,
      recovery: 20,
      onHit: 2,
      onBlock: -3,
      hitstop: 10,
    });
    const data: FighterData = {
      characterId: 'test',
      jump: { prejump: 4, air: 38, landing: 3 },
      moves: [mk('5LP'), mk('236LP'), mk('236MP'), mk('236HP'), mk('236LK')],
    };
    const moves = resolveRecipe(recipeOf(['5LP', '236P'], SF6_RULES), data, SF6_RULES);
    expect(inputsOf(moves)).toEqual([['5LP'], ['236LP', '236MP', '236HP']]);
    // ボタンを指定した手は、その技だけ
    expect(inputsOf(resolveRecipe(recipeOf(['5LP', '236MP'], SF6_RULES), data, SF6_RULES))).toEqual([['5LP'], ['236MP']]);
  });

  it('当たる技が 1 つもない手（[4]6P）を含むと null', () => {
    expect(resolveRecipe(recipeOf(['5LP', '[4]6P'], SF6_RULES), cammy.c.data, SF6_RULES)).toBeNull();
    expect(resolveRecipe(recipeOf(['[4]6P', '5LP'], SF6_RULES), cammy.c.data, SF6_RULES)).toBeNull();
  });

  it('最後でない手に 2HK（ダウンする）があると null。最後ならよい', () => {
    expect(resolveRecipe(recipeOf(['2HK', '5LP'], SF6_RULES), cammy.c.data, SF6_RULES)).toBeNull();
    expect(resolveRecipe(recipeOf(['5LP', '2HK', '5LP'], SF6_RULES), cammy.c.data, SF6_RULES)).toBeNull();
    expect(resolveRecipe(recipeOf(['5LP', '2HK'], SF6_RULES), cammy.c.data, SF6_RULES)).not.toBeNull();
  });

  it('最後でない手に 236HK（反応のデータなし）があると null。最後ならよい', () => {
    expect(resolveRecipe(recipeOf(['2MP', '236HK', '5LP'], SF6_RULES), cammy.c.data, SF6_RULES)).toBeNull();
    expect(resolveRecipe(recipeOf(['236HK', '5LP'], SF6_RULES), cammy.c.data, SF6_RULES)).toBeNull();
    expect(resolveRecipe(recipeOf(['2MP', '236HK'], SF6_RULES), cammy.c.data, SF6_RULES)).not.toBeNull();
  });

  it('最後でない手にダウンする必殺技（623HK）があっても null', () => {
    expect(resolveRecipe(recipeOf(['2MK', '623HK', '5LP'], SF6_RULES), cammy.c.data, SF6_RULES)).toBeNull();
  });

  it('1 手だけのレシピも決まる', () => {
    expect(inputsOf(resolveRecipe(recipeOf(['5LP'], SF6_RULES), cammy.c.data, SF6_RULES))).toEqual([['5LP']]);
  });
});

// ---------------------------------------------------------------- 受け入れ条件 2（例の表）

describe('stepSimTrial: 5LP → 5LP（キャミィ。5LP は 3 で当たり、4〜12 が止まる。キャラは 22、相手は 27 で動ける）', () => {
  const LP = b(5, 'LP');
  const play = (second: [number, FrameInput][], length = 60) => run(['5LP', '5LP'], [[0, LP], ...second], length);

  it('下準備: 5LP は 3 で当たる（この表の前提）', () => {
    expect(play([]).contactFrames).toEqual([3]);
  });

  it('22 で 5LP: 成功、最速 +0F（猶予 2F）。1 手目は 3 で成功（timing なし）', () => {
    const r = play([[22, LP]]);
    expect(r.events).toEqual([[3, hit(0)], [25, complete(1, { offset: 0, window: 2 })]]);
    expect(r.finalStepIndex()).toBe(0);
  });

  it('23 で 5LP: 成功、+1F（猶予 2F）', () => {
    expect(play([[23, LP]]).events).toEqual([[3, hit(0)], [26, complete(1, { offset: 1, window: 2 })]]);
  });

  it('24 で 5LP: 失敗: 遅い（1F）。27 で当たるが相手は直前に硬直の残り 1', () => {
    const r = play([[24, LP]]);
    expect(r.events).toEqual([[3, hit(0)], [27, drop(1, 'late', 1)]]);
    expect(r.finalStepIndex()).toBe(0);
  });

  it('18 で 5LP: 成功、N = −4（先行入力。22 に出る）', () => {
    expect(play([[18, LP]]).events).toEqual([[3, hit(0)], [25, complete(1, { offset: -4, window: 2 })]]);
  });

  it('17 で 5LP: 失敗: 早い（あと 1F 遅く）。27 で相手が free になったところで決まる', () => {
    const r = play([[17, LP]]);
    expect(r.events).toEqual([[3, hit(0)], [27, drop(1, 'early', 1)]]);
    expect(r.finalStepIndex()).toBe(0);
  });

  it('13 で 5LP: チェーン（キャンセル）で 13 に出る。成功、+10F（猶予 13F）', () => {
    expect(play([[13, LP]]).events).toEqual([[3, hit(0)], [16, complete(1, { offset: 10, window: 13 })]]);
  });

  it('8 で 5LP: チェーン、13 に出る。成功、+5F（猶予 13F）', () => {
    expect(play([[8, LP]]).events).toEqual([[3, hit(0)], [16, complete(1, { offset: 5, window: 13 })]]);
  });

  it('何も押さない: 27 で失敗: 遅い（フレーム数なし）', () => {
    const r = play([]);
    expect(r.events).toEqual([[3, hit(0)], [27, drop(1, 'late', null)]]);
    expect(r.stepIndexAt(26)).toBe(1);
    expect(r.finalStepIndex()).toBe(0);
  });

  it('13 で 5MP: キャンセル先でなく、先行入力は 18 で消える（早いにはしない）。何も出ずに 27 で失敗: 遅い（フレーム数なし）', () => {
    expect(play([[13, b(5, 'MP')]]).events).toEqual([[3, hit(0)], [27, drop(1, 'late', null)]]);
  });

  it('20 で 5MP: 22 に 5MP が出て、失敗: 違う技', () => {
    const r = play([[20, b(5, 'MP')]]);
    expect(r.events).toEqual([[3, hit(0)], [22, drop(1, 'wrong', null)]]);
    expect(r.finalStepIndex()).toBe(0);
  });

  it('失敗のあとは 1 手目を待つ状態に戻り、続きの動きでもう一度 5LP が当たっても、新しい挑戦は始まらないまま（イベントは 1 つだけ）', () => {
    // 24 で押した 5LP が 27 で当たる。その 27 は「遅い」の失敗に使われたフレーム
    const r = play([[24, LP]], 80);
    expect(r.events.map(([, e]) => e.type)).toEqual(['hit', 'drop']);
  });
});

describe('stepSimTrial: 2MK → 623HK（2MK は 7 で当たり 8〜16 が止まる。623HK は 17 に出て 23 で当たる）', () => {
  const play = (c: number) => run(['2MK', '623HK'], [[0, b(2, 'MK')], ...c623(c, 'HK')], 80);

  it('下準備: 2MK は 7、623HK は 23 で当たる', () => {
    expect(play(4).contactFrames).toEqual([7, 23]);
  });

  it('4 で入れ終える: 成功、−3（先行入力。猶予 13F）', () => {
    expect(play(4).events).toEqual([[7, hit(0)], [23, complete(1, { offset: -3, window: 13 })]]);
  });

  it('10 で入れ終える: 成功、+3F（猶予 13F）', () => {
    expect(play(10).events).toEqual([[7, hit(0)], [23, complete(1, { offset: 3, window: 13 })]]);
  });
});

describe('stepSimTrial: 2MP → 214LP（2MP は 6 で当たり 7〜17 が止まる。214LP は 18 から出て 38 で当たる）', () => {
  it('止まっている間に入れる: 18 に出て 38 で当たる。成功、猶予 13F（12 で入れ終えたなら +6F）', () => {
    const r = run(['2MP', '214LP'], [[0, b(2, 'MP')], ...c214(12, 'LP')], 90);
    expect(r.contactFrames).toEqual([6, 38]);
    expect(r.events).toEqual([[6, hit(0)], [38, complete(1, { offset: 6, window: 13 })]]);
  });

  it('止まっている間のどこで入れても、猶予は 13F', () => {
    for (const c of [9, 14, 17]) {
      const r = run(['2MP', '214LP'], [[0, b(2, 'MP')], ...c214(c, 'LP')], 90);
      const e = r.events[1]![1];
      expect(e.type, `c=${c}`).toBe('complete');
      if (e.type === 'complete') expect(e.timing?.window, `c=${c}`).toBe(13);
    }
  });

  it('19 で入れ終える: 19 に出て 39 で当たるが、つながらない。失敗: 遅い（1F）', () => {
    const r = run(['2MP', '214LP'], [[0, b(2, 'MP')], ...c214(19, 'LP')], 90);
    expect(r.events).toEqual([[6, hit(0)], [39, drop(1, 'late', 1)]]);
  });
});

describe('stepSimTrial: 2MP → 214LP の早い（キャンセル先の手。早い = (c + 1 − inputBuffer) − 押したフレーム、c は 2MP が当たった 6）', () => {
  // 2MP を 0 で押すので、214 は 2（2MP と同時）→ 1 → 4+LP の最短で、入れ終えるのは 2 から。
  // （プランの例の「1 で入れ終える」は、2MP と同じフレーム 0 に方向 1 が要るので作れない）
  const motion = (c: number): Entries => [[c - 2, b(2)], [c - 1, b(1)], [c, b(4, 'LP')]];
  const withMP = (c: number): Entries => [[0, b(2, 'MP')], ...motion(c).filter(([f]) => f > 0)];

  it('2 で入れ終える: 先行入力は 6 で年齢 4、7 で年齢 5 になって消える。相手が free の 39 で、早い（あと 1F 遅く。届く最も早い押しは 6 + 1 − 4 = 3）', () => {
    const r = run(['2MP', '214LP'], withMP(2), 90);
    expect(r.events).toEqual([[6, hit(0)], [39, drop(1, 'early', 1)]]);
    expect(r.finalStepIndex()).toBe(0);
  });

  it('3 で入れ終える（届く最も早い押し）: 7 の止まっている間も先行入力が生きて、18 に出て成功（−3、猶予 13F）', () => {
    const r = run(['2MP', '214LP'], withMP(3), 90);
    expect(r.contactFrames).toEqual([6, 38]);
    expect(r.events).toEqual([[6, hit(0)], [38, complete(1, { offset: -3, window: 13 })]]);
  });
});

describe('stepSimTrial: 2HP → 2MP → 236HK（コンボ 2。目押しは 2HP の有利 +7 と 2MP の発生 6 で 1F だけ）', () => {
  // 数字は、プランの注記のとおり、データから数えた値（最速 = 9 + 13 + 4 + 15 = 41、最遅 = (9 + 13 + 26) − 1 − 6 = 41、猶予 1F）
  const play = (press2MP: number) =>
    run(['2HP', '2MP', '236HK'], [[0, b(2, 'HP')], [press2MP, b(2, 'MP')], ...c236(press2MP + 13, 'HK')], 120);

  it('下準備: 2HP は 9 で当たる', () => {
    expect(play(41).contactFrames[0]).toBe(9);
  });

  it('41 で 2MP（目押し）: 成功、+0F（猶予 1F）。2MP のヒットストップ中に入れた 236HK は、反応のデータがなくても完走', () => {
    const r = play(41);
    expect(r.contactFrames).toEqual([9, 47]); // 236HK は反応のデータがないので contact なし
    expect(r.events).toEqual([[9, hit(0)], [47, hit(1, { offset: 0, window: 1 })], [73, expect.objectContaining({ type: 'complete', stepIndex: 2 })]]);
    expect(r.finalStepIndex()).toBe(0);
  });

  it('42 で 2MP: 失敗: 遅い（1F）', () => {
    const r = run(['2HP', '2MP', '236HK'], [[0, b(2, 'HP')], [42, b(2, 'MP')]], 120);
    expect(r.events).toEqual([[9, hit(0)], [48, drop(1, 'late', 1)]]);
  });
});

describe('stepSimTrial: ブリジット c.S → 2S → 2HS → 236K（それぞれ前の技のヒットストップ中に入れる）', () => {
  const r = run(
    ['c.S', '2S', '2HS', '236K'],
    [[0, b(5, 'S')], [10, b(2, 'S')], [35, b(2, 'HS')], ...c236(60, 'K')],
    130,
    { who: 'bridget' },
  );

  it('完走する（当たるのは 6・31・55・79）', () => {
    expect(r.events.map(([f, e]) => [f, e.type, e.stepIndex])).toEqual([
      [6, 'hit', 0],
      [31, 'hit', 1],
      [55, 'hit', 2],
      [79, 'complete', 3],
    ]);
    expect(r.finalStepIndex()).toBe(0);
  });

  it('2S の猶予は 1 + 14 + 6 = 21F。どの手にも timing が付く（1 手目だけ null）', () => {
    expect(r.events[0]![1]).toMatchObject({ timing: null });
    expect(r.events[1]![1]).toMatchObject({ timing: { window: 21 } });
    expect(r.events[2]![1]).toMatchObject({ timing: expect.objectContaining({ window: expect.any(Number) }) });
    expect(r.events[3]![1]).toMatchObject({ timing: expect.objectContaining({ window: expect.any(Number) }) });
  });
});

describe('stepSimTrial: 押したフレームは、その技が出るもとになった押しで決まる（関係のない押しの記録に引きずられない）', () => {
  const LP = b(5, 'LP');
  const MP = b(5, 'MP');

  it('5LP → 5LP → 5LP: 13 で 5LP（チェーンですぐ出る）、15 で 5LP（次の手のための押し）。2 手目の offset は 10（猶予 13F）', () => {
    const r = run(['5LP', '5LP', '5LP'], [[0, LP], [13, LP], [15, LP]], 40);
    expect(r.events.slice(0, 2)).toEqual([[3, hit(0)], [16, hit(1, { offset: 10, window: 13 })]]);
  });

  it('5LP → 5LP → 5LP: 22 で 5LP（目押し）、24 で 5LP。2 手目は offset 0・猶予 2F', () => {
    const r = run(['5LP', '5LP', '5LP'], [[0, LP], [22, LP], [24, LP]], 50);
    expect(r.events.slice(0, 2)).toEqual([[3, hit(0)], [25, hit(1, { offset: 0, window: 2 })]]);
  });

  it('5LP → 5LP: 2 で 5LP（先行入力）、3 で 5MP（上書き）、13 で 5LP（窓ですぐ出る）。offset は 10（上書きされた 2 の押しは使わない）', () => {
    const r = run(['5LP', '5LP'], [[0, LP], [2, LP], [3, MP], [13, LP]], 40);
    expect(r.events).toEqual([[3, hit(0)], [16, complete(1, { offset: 10, window: 13 })]]);
  });

  it('5LP → 5LP: 20 で 5LP、21 で 5MP、22 で 5LP（動ける状態ですぐ出る）。offset は 0（猶予 2F）', () => {
    const r = run(['5LP', '5LP'], [[0, LP], [20, LP], [21, MP], [22, LP]], 50);
    expect(r.events).toEqual([[3, hit(0)], [25, complete(1, { offset: 0, window: 2 })]]);
  });

  it('5LP → 5LP: 17 で 5LP、22 で 5LP。17 の先行入力は 22 で年齢 5 になって消え、22 の新しい押しがそのフレームに出る。offset は 0（猶予 2F）', () => {
    const r = run(['5LP', '5LP'], [[0, LP], [17, LP], [22, LP]], 40);
    expect(r.events).toEqual([[3, hit(0)], [25, complete(1, { offset: 0, window: 2 })]]);
  });

  it('5LP → 5LP: 18 で 5LP、22 で 5LP。18 の先行入力は 22 でも年齢 4 で生きていて 22 に出る。先行入力の記録を使い、offset は -4（猶予 2F）', () => {
    const r = run(['5LP', '5LP'], [[0, LP], [18, LP], [22, LP]], 40);
    expect(r.events).toEqual([[3, hit(0)], [25, complete(1, { offset: -4, window: 2 })]]);
  });
});

// ---------------------------------------------------------------- 受け入れ条件 3

describe('stepSimTrial: 1 手目（第15段階 受け入れ条件 3）', () => {
  const LP = b(5, 'LP');

  it('押しただけでは始まらない。当たったフレーム（3）で stepIndex が 1 になる', () => {
    const r = run(['5LP', '5LP'], [[0, LP]], 10);
    for (let n = -ORIGIN; n <= 2; n++) expect(r.stepIndexAt(n), `n=${n}`).toBe(0);
    expect(r.stepIndexAt(3)).toBe(1);
  });

  it('1 手目と違う技を押しても始まらない（イベントなし）', () => {
    const r = run(['5LP', '5LP'], [[0, b(5, 'MP')]], 40);
    expect(r.events).toEqual([]);
    expect(r.finalStepIndex()).toBe(0);
  });

  it('ダウン中の相手に当てても、2 手以上のレシピは始まらない（stepIndex 0 のまま）', () => {
    const down: DummyState = { phase: 'down', remaining: 200 };
    const r = run(['5LP', '5LP'], [[0, LP]], 20, { dummy: down });
    expect(r.contactFrames).toEqual([]); // 下準備: ダウン中は当たらない
    expect(r.events).toEqual([]);
    for (let n = 0; n < 20; n++) expect(r.stepIndexAt(n), `n=${n}`).toBe(0);
  });

  it('1 手だけのレシピは、当たったフレームで完走（timing なし）して stepIndex 0', () => {
    const r = run(['5LP'], [[0, LP]], 20);
    expect(r.events).toEqual([[3, complete(0)]]);
    expect(r.finalStepIndex()).toBe(0);
  });

  it('完走のあとは stepIndex 0 に戻り、あとから 5LP を押しても、いまの挑戦のつづきにならない', () => {
    const r = run(['5LP', '5LP'], [[0, LP], [22, LP]], 80);
    expect(r.events[1]![1].type).toBe('complete');
    expect(r.stepIndexAt(25)).toBe(0);
    expect(r.finalStepIndex()).toBe(0);
  });

  it('失敗のあとは stepIndex 0', () => {
    const r = run(['5LP', '5LP'], [[0, LP]], 40);
    expect(r.events[1]![1].type).toBe('drop');
    expect(r.stepIndexAt(27)).toBe(0);
  });
});
