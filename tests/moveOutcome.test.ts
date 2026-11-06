// 第16段階 受け入れ条件 1〜9: コマンド練習で「出た技」を決める。
// 条件 1〜8 は、本物の stepFighter・stepDummy で毎フレーム進め、before・after と attempt を stepMoveOutcome に渡して確かめる。
// フレームは、最初のボタンを押したフレームを 0 とする（キャミィ、inputBuffer = 4、相手はヒット）。
import { describe, expect, it } from 'vitest';
import { CHARACTERS, moveToCommand } from '../src/core/characters';
import type { CharacterData } from '../src/core/characters';
import { SF6_RULES } from '../src/core/commands';
import { analyzeAttempt } from '../src/core/detect';
import { INITIAL_DUMMY, stepDummy } from '../src/core/dummy';
import { INITIAL_FIGHTER, stepFighter } from '../src/core/fighter';
import type { FighterState } from '../src/core/fighter';
import { fighterDataFor } from '../src/core/frameData';
import type { MoveFrames } from '../src/core/frameData';
import { IDLE_OUTCOME, moveMatchesCommand, stepMoveOutcome } from '../src/core/moveOutcome';
import type { MoveOutcome, OutcomeState } from '../src/core/moveOutcome';
import type { CommandDef, FrameInput } from '../src/core/types';

const INPUT_BUFFER = 4;
const RULES = SF6_RULES;
const CAMMY = CHARACTERS.find((c) => c.id === 'cammy') as CharacterData;
const DATA = fighterDataFor('cammy')!;
const subject = { data: DATA, character: CAMMY };

const N: FrameInput = { dir: 5, buttons: [] };
const b = (dir: FrameInput['dir'], ...buttons: string[]): FrameInput => ({ dir, buttons });
type Entries = [number, FrameInput][];
const c236 = (f: number, btn: string): Entries => [[f - 2, b(2)], [f - 1, b(3)], [f, b(6, btn)]];

/** キャミィの技を表記で引く */
const moveOf = (input: string): MoveFrames => {
  const m = DATA.moves.find((x) => x.input === input);
  if (m === undefined) throw new Error(`技がありません: ${input}`);
  return m;
};

/** コマンド練習で選ぶ技（スパイラルアロー 236K）のコマンド */
const SPIRAL: CommandDef = (() => {
  const mv = CAMMY.moves.find((x) => x.id === 'cammy-spiral-arrow')!;
  const def = moveToCommand(mv, RULES, 'ja');
  if (def === null) throw new Error('スパイラルアローのコマンドが作れません');
  return def;
})();

const ORIGIN = 20; // 最初のボタンの前の free の長さ。frame n の入力は inputs[ORIGIN + n]

/** attempt: 試しのあるフレーム（frame 0 からの番号）。'spiral' のときは、選んだ技 236K の analyzeAttempt が結果を返したフレーム */
function play(entries: Entries, length: number, attempt: readonly number[] | 'spiral') {
  const inputs: FrameInput[] = Array.from({ length: ORIGIN + length }, () => N);
  for (const [f, input] of entries) inputs[ORIGIN + f] = input;
  let fighter: FighterState = INITIAL_FIGHTER;
  let dummy = INITIAL_DUMMY;
  let state: OutcomeState = IDLE_OUTCOME;
  const history: FrameInput[] = [];
  const outcomes: [number, MoveOutcome][] = [];
  const states: OutcomeState[] = [];
  const fighters: FighterState[] = [];
  inputs.forEach((input, i) => {
    history.push(input);
    const stepped = stepFighter(fighter, history, subject, RULES, INPUT_BUFFER);
    const r = stepDummy(dummy, stepped, 'hit');
    const n = i - ORIGIN;
    const isAttempt = attempt === 'spiral' ? analyzeAttempt(history, SPIRAL) !== null : attempt.includes(n);
    const out = stepMoveOutcome(state, fighter, r.fighter, isAttempt);
    state = out.state;
    if (out.outcome !== null) outcomes.push([n, out.outcome]);
    states.push(state);
    fighters.push(r.fighter);
    fighter = r.fighter;
    dummy = r.dummy;
  });
  return {
    outcomes,
    stateAt: (n: number) => states[ORIGIN + n]!,
    fighterAt: (n: number) => fighters[ORIGIN + n]!,
  };
}

const moveInputOf = (o: MoveOutcome | undefined) => (o?.kind === 'move' ? o.move.input : undefined);

describe('技が出た: 動けるとき (第16段階 受け入れ条件 1・2)', () => {
  it('1. 236HK が成立 → そのフレームで move（236HK・direct）', () => {
    const run = play(c236(0, 'HK'), 10, 'spiral');
    expect(run.outcomes).toHaveLength(1);
    const [n, o] = run.outcomes[0]!;
    expect(n).toBe(0);
    expect(o).toMatchObject({ kind: 'move', via: 'direct' });
    expect(moveInputOf(o)).toBe('236HK');
    expect(run.stateAt(0)).toEqual({ kind: 'idle' });
  });

  it('2. 236 が崩れて 2 + MK → そのフレームで move（2MK・direct）。選んだ技（236K）とは別の技', () => {
    const run = play([[-2, b(2)], [-1, b(2)], [0, b(2, 'MK')]], 10, 'spiral');
    expect(run.outcomes).toHaveLength(1);
    const [n, o] = run.outcomes[0]!;
    expect(n).toBe(0);
    expect(o).toMatchObject({ kind: 'move', via: 'direct' });
    expect(moveInputOf(o)).toBe('2MK');
    expect(moveMatchesCommand(moveOf('2MK'), SPIRAL, RULES)).toBe(false);
  });
});

describe('技が出た: 技の途中に押した (第16段階 受け入れ条件 3〜5・8)', () => {
  const LP = b(5, 'LP');

  it('3. 5LP（ヒット）のあと 13 で 2LP（チェーン）→ そのフレームで move（2LP・cancel）', () => {
    const run = play([[0, LP], [13, b(2, 'LP')]], 30, [13]);
    expect(run.outcomes).toHaveLength(1);
    const [n, o] = run.outcomes[0]!;
    expect(n).toBe(13);
    expect(o).toMatchObject({ kind: 'move', via: 'cancel' });
    expect(moveInputOf(o)).toBe('2LP');
  });

  it('4. 5LP（ヒット）のあと 18 で 5MP → 18 は pending、22 で move（5MP・buffer）', () => {
    const run = play([[0, LP], [18, b(5, 'MP')]], 40, [18]);
    expect(run.stateAt(18)).toEqual({ kind: 'pending', move: moveOf('5MP') });
    for (let n = 19; n <= 21; n++) expect(run.stateAt(n).kind, `n=${n}`).toBe('pending');
    expect(run.outcomes).toHaveLength(1);
    const [n, o] = run.outcomes[0]!;
    expect(n).toBe(22);
    expect(o).toMatchObject({ kind: 'move', via: 'buffer' });
    expect(moveInputOf(o)).toBe('5MP');
    expect(run.stateAt(22)).toEqual({ kind: 'idle' });
  });

  it('5. 5LP（ヒット）のあと 13 で 5MP（キャンセル先でない）→ pending、18 で none・bufferLost', () => {
    const run = play([[0, LP], [13, b(5, 'MP')]], 40, [13]);
    expect(run.stateAt(13)).toEqual({ kind: 'pending', move: moveOf('5MP') });
    for (let n = 14; n <= 17; n++) expect(run.stateAt(n).kind, `n=${n}`).toBe('pending');
    expect(run.outcomes).toEqual([[18, { kind: 'none', reason: 'bufferLost' }]]);
    expect(run.stateAt(18)).toEqual({ kind: 'idle' });
  });

  it('8. pending の間に次の試しが来たら、新しい試しで決め直す（前の pending は捨てる）', () => {
    // 18 で 5MP が先行入力に入り、20 で 5LK に上書きされる。結果は 5LK だけで、5MP の結果は出ない
    const run = play([[0, LP], [18, b(5, 'MP')], [19, N], [20, b(5, 'LK')]], 40, [18, 20]);
    expect(run.stateAt(18)).toEqual({ kind: 'pending', move: moveOf('5MP') });
    expect(run.stateAt(20)).toEqual({ kind: 'pending', move: moveOf('5LK') });
    expect(run.outcomes).toHaveLength(1);
    const [n, o] = run.outcomes[0]!;
    expect(n).toBe(22);
    expect(o).toMatchObject({ kind: 'move', via: 'buffer' });
    expect(moveInputOf(o)).toBe('5LK');
  });

  it('8. 待っている間の試しで、その場で技が始まる（キャンセル）なら、すぐ move にして idle に戻る', () => {
    // 5LP のあと 13 で 5MP（キャンセル先でないので待つ）、14 で 2LP（チェーン先なので始まる）
    const run = play([[0, LP], [13, b(5, 'MP')], [14, b(2, 'LP')]], 40, [13, 14]);
    expect(run.stateAt(13).kind).toBe('pending');
    expect(run.outcomes).toHaveLength(1);
    const [n, o] = run.outcomes[0]!;
    expect(n).toBe(14);
    expect(o).toMatchObject({ kind: 'move', via: 'cancel' });
    expect(moveInputOf(o)).toBe('2LP');
    expect(run.stateAt(14)).toEqual({ kind: 'idle' });
  });
});

describe('予約から出た技は、試しのフレームでも「出た技」にしない (第16段階 決め)', () => {
  const LP = b(5, 'LP');
  // 5LP（3 で当たり、4〜12 は止まる）。止まっている 8 に 2LP を押して予約し、止まり終わる 13 に 5MP を押す
  const entries: Entries = [[0, LP], [8, b(2, 'LP')], [13, b(5, 'MP')]];

  it('13 の試し: 2LP が予約から始まっても、none・bufferLost', () => {
    const run = play(entries, 40, [13]);
    // 前提: 8 で 2LP が予約され、13 に 2LP が始まる（キャンセル）。5MP は先行入力に入らない
    expect(run.fighterAt(8).cancelTo).toBe(moveOf('2LP'));
    expect(run.fighterAt(12).cancelTo).toBe(moveOf('2LP'));
    expect(run.fighterAt(13).move?.input).toBe('2LP');
    expect(run.fighterAt(13).frame).toBe(0);
    expect(run.fighterAt(13).canceled).toBe(true);
    expect(run.fighterAt(13).buffered).toBeNull();
    expect(run.outcomes).toEqual([[13, { kind: 'none', reason: 'bufferLost' }]]);
    expect(run.stateAt(13)).toEqual({ kind: 'idle' });
  });

  it('比べ: 8 の 2LP を試しにすると pending → 13 で move（2LP・cancel）', () => {
    const run = play([[0, LP], [8, b(2, 'LP')]], 40, [8]);
    expect(run.stateAt(8)).toEqual({ kind: 'pending', move: moveOf('2LP') });
    expect(run.outcomes).toHaveLength(1);
    const [n, o] = run.outcomes[0]!;
    expect(n).toBe(13);
    expect(o).toMatchObject({ kind: 'move', via: 'cancel' });
    expect(moveInputOf(o)).toBe('2LP');
  });
});

describe('技が出なかった (第16段階 受け入れ条件 6・7)', () => {
  it('6. 跳んでいる間（air）に LP → そのフレームで none・air', () => {
    const run = play([[0, b(8)], [10, b(8, 'LP')]], 20, [10]);
    expect(run.fighterAt(9).phase).toBe('air'); // 前提: 10 の前のフレームは空中
    expect(run.outcomes).toEqual([[10, { kind: 'none', reason: 'air' }]]);
  });

  it('7. 動けるときに、ジャンプ方向 + ボタンで技が選ばれない → attempt でも何も始まらず none・noMove', () => {
    const run = play([[0, b(9, 'LK')]], 10, [0]);
    expect(run.fighterAt(-1).phase).toBe('idle'); // 前提: 押す前は動ける
    expect(run.fighterAt(0).move).toBeNull(); // 前提: 技は始まらない
    expect(run.fighterAt(0).buffered).toBeNull(); // 前提: 先行入力にも入らない
    expect(run.outcomes).toEqual([[0, { kind: 'none', reason: 'noMove' }]]);
  });

  it('試しがなければ、何が起きても outcome は出ない（idle のまま）', () => {
    const run = play([[0, b(5, 'LP')]], 30, []);
    expect(run.outcomes).toEqual([]);
    expect(run.stateAt(29)).toEqual({ kind: 'idle' });
  });
});

describe('moveMatchesCommand (第16段階 受け入れ条件 9)', () => {
  it('236HK と、スパイラルアロー (236K) のコマンド → true', () => {
    expect(moveMatchesCommand(moveOf('236HK'), SPIRAL, RULES)).toBe(true);
  });

  it('214LP と 236K → false（表記が違う）', () => {
    expect(moveMatchesCommand(moveOf('214LP'), SPIRAL, RULES)).toBe(false);
  });

  it('通常技は false', () => {
    expect(moveMatchesCommand(moveOf('5LK'), SPIRAL, RULES)).toBe(false);
  });

  it('同じ表記でも、ボタンがコマンドに入っていなければ false（236P の技は 236K に当たらない）', () => {
    const p = DATA.moves.find((m) => /^236[LMH]P$/.test(m.input));
    if (p !== undefined) expect(moveMatchesCommand(p, SPIRAL, RULES)).toBe(false);
  });
});
