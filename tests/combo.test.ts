import { describe, expect, it } from 'vitest';
import {
  initialTrialState,
  isAttemptInProgress,
  matchesStep,
  parseRecipe,
  stepTrial,
} from '../src/core/combo';
import type { ComboRecipe, TrialEvent, TrialState } from '../src/core/combo';
import { parseStep } from '../src/core/notation';
import { SF6_COMMANDS } from '../src/core/commands';
import { PROFILES } from '../src/core/profiles';
import type { Direction, FrameInput } from '../src/core/types';

const JAPANESE = /[぀-ヿ一-鿿]/;

const f = (dir: Direction, ...buttons: string[]): FrameInput => ({ dir, buttons });
const N = f(5);

function step(text: string) {
  const r = parseStep(text, PROFILES.sf6);
  if (!r.ok) throw new Error(`${text}: ${r.error}`);
  return r.input;
}

function recipe(...steps: [string, [number, number]?][]): ComboRecipe {
  const json = {
    id: 'test',
    name: 'テスト',
    steps: steps.map(([input, window]) => (window ? { input, window } : { input })),
  };
  const r = parseRecipe(json, PROFILES.sf6);
  if (!r.ok) throw new Error(r.error);
  return r.recipe;
}

/** length フレームぶんの入力を作る。presses で指定したフレーム（相対）以外はニュートラル */
function timeline(length: number, presses: Record<number, FrameInput>): FrameInput[] {
  const out: FrameInput[] = [];
  for (let i = 0; i < length; i++) {
    out.push(presses[i] ?? N);
  }
  return out;
}

/** 入力列を1フレームずつ stepTrial に流す。startFrame から毎フレーム 1 ずつ増やす */
function run(
  r: ComboRecipe,
  inputs: readonly FrameInput[],
  startFrame = 0,
  initial: TrialState = initialTrialState(),
) {
  let state = initial;
  const events: (TrialEvent | null)[] = [];
  const states: TrialState[] = [];
  inputs.forEach((_, i) => {
    const res = stepTrial(state, r, inputs.slice(0, i + 1), startFrame + i);
    state = res.state;
    events.push(res.event);
    states.push(res.state);
  });
  return { events, states, state };
}

describe('matchesStep: normal (受け入れ条件 2)', () => {
  it('押した瞬間で、方向が dirs に入っていれば true（2LP は 1/2/3）', () => {
    const s = step('2LP');
    expect(matchesStep([N, f(2, 'LP')], s)).toBe(true);
    expect(matchesStep([N, f(1, 'LP')], s)).toBe(true);
    expect(matchesStep([N, f(3, 'LP')], s)).toBe(true);
  });

  it('1つ前のフレームがなければ押された扱い', () => {
    expect(matchesStep([f(2, 'LP')], step('2LP'))).toBe(true);
  });

  it('方向が dirs 外なら false', () => {
    expect(matchesStep([N, f(5, 'LP')], step('2LP'))).toBe(false);
    expect(matchesStep([N, f(6, 'LP')], step('2LP'))).toBe(false);
    expect(matchesStep([N, f(2, 'LP')], step('5LP'))).toBe(false);
  });

  it('押しっぱなしのフレームは false', () => {
    expect(matchesStep([f(2, 'LP'), f(2, 'LP')], step('2LP'))).toBe(false);
  });

  it('別のボタンなら false。押しっぱなしの上に別ボタンを足した瞬間は true', () => {
    expect(matchesStep([N, f(2, 'MP')], step('2LP'))).toBe(false);
    expect(matchesStep([f(2, 'LP'), f(2, 'LP', 'MP')], step('2MP'))).toBe(true);
  });

  it('P のまとめ指定はどの P ボタンでも true、K ボタンでは false', () => {
    const s = step('5P');
    expect(matchesStep([N, f(5, 'LP')], s)).toBe(true);
    expect(matchesStep([N, f(5, 'MP')], s)).toBe(true);
    expect(matchesStep([N, f(5, 'HP')], s)).toBe(true);
    expect(matchesStep([N, f(5, 'LK')], s)).toBe(false);
  });
});

describe('matchesStep: command (受け入れ条件 2)', () => {
  it('2,3,6 のあと同じフレームで HP を押すと 236HP が成立', () => {
    expect(matchesStep([f(2), f(3), f(6, 'HP')], step('236HP'))).toBe(true);
  });

  it('モーションが足りないまま HP は false', () => {
    expect(matchesStep([f(2), f(6, 'HP')], step('236HP'))).toBe(false);
    expect(matchesStep([N, f(5, 'HP')], step('236HP'))).toBe(false);
  });

  it('ボタンが違えば false（236HP に LP）', () => {
    expect(matchesStep([f(2), f(3), f(6, 'LP')], step('236HP'))).toBe(false);
  });

  it('236P のまとめ指定は LP でも HP でも成立', () => {
    expect(matchesStep([f(2), f(3), f(6, 'LP')], step('236P'))).toBe(true);
    expect(matchesStep([f(2), f(3), f(6, 'HP')], step('236P'))).toBe(true);
  });

  it('押しっぱなしのフレームは false', () => {
    expect(matchesStep([f(2), f(3), f(6, 'HP'), f(6, 'HP')], step('236HP'))).toBe(false);
  });

  it('360 は 1 回転 + ボタンで成立、回転が足りなければ false', () => {
    const s = step('360LP');
    const full = [f(4), f(1), f(2), f(3), f(6), f(9), f(8), f(7, 'LP')];
    expect(matchesStep(full, s)).toBe(true);
    expect(matchesStep([f(5), f(5), f(5, 'LP')], s)).toBe(false);
  });
});

describe('parseRecipe (受け入れ条件 3)', () => {
  const valid = {
    id: 'sample-1',
    name: '小足2回から波動',
    steps: [
      { input: '2LP' },
      { input: '2LP', window: [10, 14] },
      { input: '236HP', window: [0, 10] },
    ],
  };

  it('正しい JSON を読む', () => {
    const r = parseRecipe(valid, PROFILES.sf6);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.recipe.id).toBe('sample-1');
    expect(r.recipe.name).toBe('小足2回から波動');
    expect(r.recipe.steps).toHaveLength(3);
    expect(r.recipe.steps.map((s) => s.text)).toEqual(['2LP', '2LP', '236HP']);
    expect(r.recipe.steps.map((s) => s.window)).toEqual([
      null,
      { min: 10, max: 14 },
      { min: 0, max: 10 },
    ]);
    expect(r.recipe.steps[2]!.input).toEqual(step('236HP'));
  });

  it('最初の手の window は無視して null にする', () => {
    const r = parseRecipe(
      { id: 'a', name: 'b', steps: [{ input: '2LP', window: [3, 4] }, { input: '2LP', window: [1, 2] }] },
      PROFILES.sf6,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.recipe.steps[0]!.window).toBeNull();
  });

  it('手が1つだけのレシピは window なしで読める', () => {
    expect(parseRecipe({ id: 'a', name: 'b', steps: [{ input: '5MP' }] }, PROFILES.sf6).ok).toBe(true);
  });

  it('min == max や 0 の窓も読める', () => {
    const r = parseRecipe(
      { id: 'a', name: 'b', steps: [{ input: '2LP' }, { input: '2LP', window: [0, 0] }] },
      PROFILES.sf6,
    );
    expect(r.ok).toBe(true);
  });

  const withStep = (s: unknown) => ({ id: 'a', name: 'b', steps: [{ input: '2LP' }, s] });
  const badCases: [string, unknown][] = [
    ['null', null],
    ['文字列', 'abc'],
    ['配列', []],
    ['id なし', { name: 'b', steps: [{ input: '2LP' }] }],
    ['id が空文字', { id: '', name: 'b', steps: [{ input: '2LP' }] }],
    ['id が数値', { id: 1, name: 'b', steps: [{ input: '2LP' }] }],
    ['name なし', { id: 'a', steps: [{ input: '2LP' }] }],
    ['name が空文字', { id: 'a', name: '', steps: [{ input: '2LP' }] }],
    ['steps なし', { id: 'a', name: 'b' }],
    ['steps が配列でない', { id: 'a', name: 'b', steps: 'x' }],
    ['steps が空', { id: 'a', name: 'b', steps: [] }],
    ['input が読めない', withStep({ input: 'zzz', window: [1, 2] })],
    ['input がない', withStep({ window: [1, 2] })],
    ['2手目に window がない', withStep({ input: '2LP' })],
    ['window が配列でない', withStep({ input: '2LP', window: 5 })],
    ['window の長さが 1', withStep({ input: '2LP', window: [1] })],
    ['window の長さが 3', withStep({ input: '2LP', window: [1, 2, 3] })],
    ['window が負数', withStep({ input: '2LP', window: [-1, 2] })],
    ['window が小数', withStep({ input: '2LP', window: [1.5, 2] })],
    ['window が文字列', withStep({ input: '2LP', window: ['1', '2'] })],
    ['min > max', withStep({ input: '2LP', window: [5, 4] })],
  ];
  for (const [label, json] of badCases) {
    it(`${label} は ok:false で日本語のエラー`, () => {
      const r = parseRecipe(json, PROFILES.sf6);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(JAPANESE);
    });
  }

  it('エラーに何手目かが含まれる（3手目の window が悪い場合は 3）', () => {
    const r = parseRecipe(
      {
        id: 'a',
        name: 'b',
        steps: [{ input: '2LP' }, { input: '2LP', window: [1, 2] }, { input: '2LP', window: [5, 4] }],
      },
      PROFILES.sf6,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('3');
  });
});

describe('stepTrial: 最初の手 (受け入れ条件 4)', () => {
  const r2 = recipe(['2LP'], ['2LP', [10, 14]]);

  it('最初の手を待つあいだの他の押下は失敗にならず、何も起きない', () => {
    const inputs = [f(5, 'LP'), N, f(2, 'MP'), N, f(6, 'HP'), N];
    const out = run(r2, inputs, 40);
    expect(out.events.every((e) => e === null)).toBe(true);
    expect(out.state).toEqual(initialTrialState());
  });

  it('最初の手が成立すると hit(offset=null)、state は stepIndex=1・lastPressFrame=frame', () => {
    const out = run(r2, [N, N, f(2, 'LP')], 100);
    expect(out.events[0]).toBeNull();
    expect(out.events[2]).toEqual({ type: 'hit', stepIndex: 0, offset: null });
    expect(out.state).toEqual({ stepIndex: 1, lastPressFrame: 102 });
  });

  it('手が1つだけのレシピは最初の手で complete、state は初期に戻る', () => {
    const one = recipe(['5MP']);
    const out = run(one, [N, f(5, 'MP')], 7);
    expect(out.events[1]).toEqual({ type: 'complete', stepIndex: 0, offset: null });
    expect(out.state).toEqual(initialTrialState());
  });
});

describe('stepTrial: 窓の境界 (受け入れ条件 4)', () => {
  const r2 = recipe(['2LP'], ['2LP', [10, 14]]);

  it('offset がちょうど min なら成立（最後の手なので complete）', () => {
    const out = run(r2, timeline(11, { 0: f(2, 'LP'), 10: f(2, 'LP') }), 0);
    expect(out.events[0]).toEqual({ type: 'hit', stepIndex: 0, offset: null });
    expect(out.events.slice(1, 10).every((e) => e === null)).toBe(true);
    expect(out.events[10]).toEqual({ type: 'complete', stepIndex: 1, offset: 10 });
  });

  it('offset がちょうど max でも成立', () => {
    const out = run(r2, timeline(15, { 0: f(2, 'LP'), 14: f(2, 'LP') }), 0);
    expect(out.events.slice(1, 14).every((e) => e === null)).toBe(true);
    expect(out.events[14]).toEqual({ type: 'complete', stepIndex: 1, offset: 14 });
  });

  it('offset が min-1 なら drop(early)', () => {
    const out = run(r2, timeline(10, { 0: f(2, 'LP'), 9: f(2, 'LP') }), 0);
    expect(out.events[9]).toEqual({ type: 'drop', stepIndex: 1, reason: 'early', offset: 9 });
    expect(out.state).toEqual(initialTrialState());
  });

  it('max+1 のフレームで drop(late)。max のフレームまでは何も起きない', () => {
    const out = run(r2, timeline(16, { 0: f(2, 'LP') }), 0);
    expect(out.events.slice(1, 15).every((e) => e === null)).toBe(true);
    expect(out.events[15]).toEqual({ type: 'drop', stepIndex: 1, reason: 'late', offset: 15 });
    expect(out.state).toEqual(initialTrialState());
  });

  it('startFrame が 0 でなくても、通算フレームの差で offset を数える', () => {
    const out = run(r2, timeline(13, { 0: f(2, 'LP'), 12: f(2, 'LP') }), 500);
    expect(out.events[12]).toEqual({ type: 'complete', stepIndex: 1, offset: 12 });
  });

  it('途中の手の成立は hit（complete ではない）で、state が進む', () => {
    const r3 = recipe(['2LP'], ['2LP', [10, 14]], ['236HP', [0, 10]]);
    const out = run(r3, timeline(11, { 0: f(2, 'LP'), 10: f(2, 'LP') }), 0);
    expect(out.events[10]).toEqual({ type: 'hit', stepIndex: 1, offset: 10 });
    expect(out.state).toEqual({ stepIndex: 2, lastPressFrame: 10 });
  });

  it('必殺技の手: 窓の中で成立なら complete、offset は前の手から', () => {
    const r3 = recipe(['2LP'], ['2LP', [10, 14]], ['236HP', [0, 10]]);
    const inputs = timeline(14, { 0: f(2, 'LP'), 10: f(2, 'LP'), 11: f(2), 12: f(3), 13: f(6, 'HP') });
    const out = run(r3, inputs, 0);
    expect(out.events[10]).toEqual({ type: 'hit', stepIndex: 1, offset: 10 });
    expect(out.events[11]).toBeNull();
    expect(out.events[12]).toBeNull();
    expect(out.events[13]).toEqual({ type: 'complete', stepIndex: 2, offset: 3 });
  });

  it('必殺技の手: max ちょうどで成立、max+1 のフレームで late', () => {
    const r3 = recipe(['2LP'], ['2LP', [10, 14]], ['236HP', [0, 10]]);
    const base = { 0: f(2, 'LP'), 10: f(2, 'LP') } as Record<number, FrameInput>;
    // 前の手(10)から 10F 後 = 20 で HP
    const okInputs = timeline(21, { ...base, 18: f(2), 19: f(3), 20: f(6, 'HP') });
    expect(run(r3, okInputs, 0).events[20]).toEqual({ type: 'complete', stepIndex: 2, offset: 10 });
    // 何も押さなければ 21 で late
    const lateOut = run(r3, timeline(22, base), 0);
    expect(lateOut.events[20]).toBeNull();
    expect(lateOut.events[21]).toEqual({ type: 'drop', stepIndex: 2, reason: 'late', offset: 11 });
  });
});

describe('stepTrial: wrong (受け入れ条件 4)', () => {
  it('同じボタンでも方向が違えば wrong（2LP の手で 5LP）', () => {
    const r2 = recipe(['2LP'], ['2LP', [10, 14]]);
    const out = run(r2, timeline(13, { 0: f(2, 'LP'), 12: f(5, 'LP') }), 0);
    expect(out.events[12]).toEqual({ type: 'drop', stepIndex: 1, reason: 'wrong', offset: 12 });
    expect(out.state).toEqual(initialTrialState());
  });

  it('別のボタンでも wrong（2LP の手で 2MP）', () => {
    const r2 = recipe(['2LP'], ['2LP', [10, 14]]);
    const out = run(r2, timeline(13, { 0: f(2, 'LP'), 12: f(2, 'MP') }), 0);
    expect(out.events[12]).toEqual({ type: 'drop', stepIndex: 1, reason: 'wrong', offset: 12 });
  });

  it('窓より前でも、違う入力のボタンは wrong（early ではない）', () => {
    const r2 = recipe(['2LP'], ['2LP', [10, 14]]);
    const out = run(r2, timeline(4, { 0: f(2, 'LP'), 3: f(5, 'HP') }), 0);
    expect(out.events[3]).toEqual({ type: 'drop', stepIndex: 1, reason: 'wrong', offset: 3 });
  });

  it('モーションが足りないまま HP を押すと wrong（236HP の手）', () => {
    const r3 = recipe(['2LP'], ['2LP', [10, 14]], ['236HP', [0, 10]]);
    const inputs = timeline(14, { 0: f(2, 'LP'), 10: f(2, 'LP'), 12: f(2), 13: f(6, 'HP') });
    const out = run(r3, inputs, 0);
    expect(out.events[13]).toEqual({ type: 'drop', stepIndex: 2, reason: 'wrong', offset: 3 });
  });

  it('ボタンを押さないフレーム（方向だけの変化）は wrong にならない', () => {
    const r2 = recipe(['2LP'], ['2LP', [10, 14]]);
    const out = run(r2, timeline(10, { 0: f(2, 'LP'), 3: f(6), 4: f(4), 5: f(8) }), 0);
    expect(out.events.slice(1).every((e) => e === null)).toBe(true);
  });
});

describe('stepTrial: drop・complete のあと (受け入れ条件 5)', () => {
  it('drop のフレームでは最初の手を判定しない。次のフレームからやり直せる', () => {
    // 1手目が 5LP、2手目が 2LP。窓の途中で 5LP を押すと wrong、かつ同じフレームで 1手目にはならない
    const r = recipe(['5LP'], ['2LP', [10, 14]]);
    const inputs = timeline(16, { 0: f(5, 'LP'), 12: f(5, 'LP'), 14: f(5, 'LP') });
    const out = run(r, inputs, 0);
    expect(out.events[12]).toEqual({ type: 'drop', stepIndex: 1, reason: 'wrong', offset: 12 });
    expect(out.states[12]).toEqual(initialTrialState());
    expect(out.events[13]).toBeNull();
    // 次のフレーム以降の押下は最初の手として成立
    expect(out.events[14]).toEqual({ type: 'hit', stepIndex: 0, offset: null });
    expect(out.state).toEqual({ stepIndex: 1, lastPressFrame: 14 });
  });

  it('drop の次のフレームに最初の手が成立すれば、そのフレームで hit', () => {
    const r = recipe(['2P'], ['2P', [10, 14]]);
    // f0: 2LP hit。f3: 5HP で wrong。f4: 2MP は最初の手として hit
    const inputs = timeline(5, { 0: f(2, 'LP'), 3: f(5, 'HP'), 4: f(2, 'MP') });
    const out = run(r, inputs, 0);
    expect(out.events[3]).toEqual({ type: 'drop', stepIndex: 1, reason: 'wrong', offset: 3 });
    expect(out.events[4]).toEqual({ type: 'hit', stepIndex: 0, offset: null });
    expect(out.state).toEqual({ stepIndex: 1, lastPressFrame: 4 });
  });

  it('late の drop のあとも、次のフレームから最初の手が成立する', () => {
    const r2 = recipe(['2LP'], ['2LP', [10, 14]]);
    const inputs = timeline(17, { 0: f(2, 'LP'), 16: f(2, 'LP') });
    const out = run(r2, inputs, 0);
    expect(out.events[15]).toEqual({ type: 'drop', stepIndex: 1, reason: 'late', offset: 15 });
    expect(out.events[16]).toEqual({ type: 'hit', stepIndex: 0, offset: null });
  });

  it('complete のフレームでは最初の手を判定しない。次のフレームからやり直せる', () => {
    const r = recipe(['2P'], ['2P', [0, 5]]);
    // f0: 2LP hit。f3: 2LP complete（同じ入力は 1手目にも合うが、始めない）
    // f4: 別ボタンの 2MP を足した瞬間 → 最初の手として hit
    const inputs = [f(2, 'LP'), N, N, f(2, 'LP'), f(2, 'LP', 'MP')];
    const out = run(r, inputs, 0);
    expect(out.events[3]).toEqual({ type: 'complete', stepIndex: 1, offset: 3 });
    expect(out.states[3]).toEqual(initialTrialState());
    expect(out.events[4]).toEqual({ type: 'hit', stepIndex: 0, offset: null });
    expect(out.state).toEqual({ stepIndex: 1, lastPressFrame: 4 });
  });

  it('complete のあと、もう一周完走できる', () => {
    const r2 = recipe(['2LP'], ['2LP', [10, 14]]);
    const inputs = timeline(30, { 0: f(2, 'LP'), 10: f(2, 'LP'), 12: f(2, 'LP'), 22: f(2, 'LP') });
    const out = run(r2, inputs, 0);
    expect(out.events[10]).toEqual({ type: 'complete', stepIndex: 1, offset: 10 });
    expect(out.events[12]).toEqual({ type: 'hit', stepIndex: 0, offset: null });
    expect(out.events[22]).toEqual({ type: 'complete', stepIndex: 1, offset: 10 });
  });
});

describe('isAttemptInProgress (受け入れ条件 2)', () => {
  const r2 = recipe(['2LP'], ['2LP', [10, 14]]);

  it('初期状態は false', () => {
    expect(isAttemptInProgress(initialTrialState())).toBe(false);
  });

  it('1 手目が成立したあと (hit) は true', () => {
    const out = run(r2, [N, f(2, 'LP')], 0);
    expect(out.events[1]).toMatchObject({ type: 'hit' });
    expect(isAttemptInProgress(out.state)).toBe(true);
  });

  it('途中の手が成立して続いている間も true', () => {
    const out = run(r2, timeline(5, { 0: f(2, 'LP') }), 0);
    expect(isAttemptInProgress(out.state)).toBe(true);
  });

  it('完走 (complete) のあとは false', () => {
    const out = run(r2, timeline(11, { 0: f(2, 'LP'), 10: f(2, 'LP') }), 0);
    expect(out.events[10]).toMatchObject({ type: 'complete' });
    expect(isAttemptInProgress(out.state)).toBe(false);
  });

  it('失敗 (drop) のあとは false', () => {
    const out = run(r2, timeline(16, { 0: f(2, 'LP') }), 0);
    expect(out.events[15]).toMatchObject({ type: 'drop' });
    expect(isAttemptInProgress(out.state)).toBe(false);
  });
});
