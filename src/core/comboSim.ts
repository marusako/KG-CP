// コンボトライアルを「相手に当たってつながったか」で判定する（第15段階）。
// キャラと相手の動きは、フレームメーターと同じ stepFighter・stepDummy の結果（SimFrame）をそのまま使う。
import type { ComboRecipe, StepInput } from './combo';
import type { Contact } from './contact';
import type { DummyState } from './dummy';
import type { FighterState } from './fighter';
import { contactReaction } from './frameData';
import type { FighterData, MoveFrames } from './frameData';
import { parseStep } from './notation';
import type { NotationRules } from './notation';

/** 1 フレームのキャラと相手の動き（main.ts が stepFighter・stepDummy のあとに作る） */
export interface SimFrame {
  /** 通算フレーム番号 */
  frame: number;
  /** 前のフレームのキャラ */
  before: FighterState;
  /** このフレームのキャラ（stepDummy のあと） */
  after: FighterState;
  /** 前のフレームの相手 */
  dummyBefore: DummyState;
  /** このフレームの相手 */
  dummyAfter: DummyState;
  /** このフレームで当たったか（stepDummy の contact） */
  contact: Contact | null;
}

/**
 * 技が手に当たるか。
 * 通常技は、技の入力の先頭の数字（5 か 2）が手の方向に入っていて、技のボタンが手のボタンに入っているもの。
 * コマンドは、方向の表記が同じで、技のボタンが手のボタンに入っているもの（スト6 の P は LP・MP・HP のどれでもよい）
 */
export function moveMatchesStep(move: MoveFrames, input: StepInput, rules: NotationRules): boolean {
  const parsed = parseStep(move.input, rules);
  if (!parsed.ok) return false;
  const own = parsed.input;
  if (input.kind === 'normal') {
    if (own.kind !== 'normal') return false;
    const dir = Number(move.input.charAt(0));
    return input.dirs.some((d) => d === dir) && own.buttons.every((b) => input.buttons.includes(b));
  }
  return (
    own.kind === 'command' &&
    own.command.notation === input.command.notation &&
    own.buttons.every((b) => input.buttons.includes(b))
  );
}

/**
 * レシピの手ごとに、当たる技の一覧。新しい判定にできなければ null（入力の窓で判定する）。
 * できないのは、当たる技が 1 つもない手があるとき、と、最後でない手に、ヒットで相手がヒット硬直にならない技
 * （反応のデータがない技・ダウンする技。そのあとの手はつながらない）があるとき
 */
export function resolveRecipe(
  recipe: ComboRecipe,
  data: FighterData,
  rules: NotationRules,
): readonly (readonly MoveFrames[])[] | null {
  const lists: MoveFrames[][] = [];
  for (const [i, step] of recipe.steps.entries()) {
    const list = data.moves.filter((m) => moveMatchesStep(m, step.input, rules));
    if (list.length === 0) return null;
    const isLast = i === recipe.steps.length - 1;
    if (!isLast && list.some((m) => contactReaction(m, 'hit')?.kind !== 'hitstun')) return null;
    lists.push(list);
  }
  return lists;
}

export interface SimTiming {
  /** 押したフレーム − 最速（マイナスは先行入力） */
  offset: number;
  /** 猶予のフレーム数 */
  window: number;
}

export type SimTrialEvent =
  | { type: 'hit' | 'complete'; stepIndex: number; timing: SimTiming | null }
  | { type: 'drop'; stepIndex: number; reason: 'early' | 'late' | 'wrong'; frames: number | null };

export interface SimTrialState {
  /** 次に当てる手（0 なら挑戦していない） */
  readonly stepIndex: number;
  /** 前の手が当たったフレームと、その技（次の手の最速・最遅を数える元） */
  readonly prev: { readonly frame: number; readonly move: MoveFrames } | null;
  /**
   * 手ごとの「押したフレーム」（手 k の技が先行入力に入ったフレーム）。
   * 前の手が当たる前に入れ終えた場合も数えられるよう、待っている手より先の手の分も覚えておく
   */
  readonly presses: Readonly<Record<number, number>>;
  /** 待っている手の技が出始めたときに決めた、その技の「押したフレーム」（まだ出ていなければ null） */
  readonly startPress: number | null;
}

export function initialSimTrial(): SimTrialState {
  return { stepIndex: 0, prev: null, presses: {}, startPress: null };
}

/** 前の手 prev のあとに、手の技 move が出るときの、最速・出せる最後（猶予 = 最後 − 最速 + 1）。キャンセルで出たときと目押しで違う */
function timingWindow(prev: { frame: number; move: MoveFrames }, move: MoveFrames, canceled: boolean): { earliest: number; last: number } {
  const p = prev.move;
  const hitstop = p.hitstop ?? 0;
  const reaction = contactReaction(p, 'hit');
  // 相手が動けるようになるフレーム。技が「つながる」最も遅い出始めは、その 1 つ前に持続の 1 フレーム目が来る出始め
  const free = prev.frame + hitstop + (reaction?.frames ?? 0);
  const latest = free - 1 - move.startup;
  if (canceled) return { earliest: prev.frame, last: Math.min(prev.frame + hitstop + p.active, latest) };
  return { earliest: prev.frame + hitstop + p.active + (p.contactRecovery ?? p.recovery), last: latest };
}

/** 手 index の技が出たあとの presses。index 以下の手は使い終わったので消し、それより先の手も、index の技の出始め（start）より前の押しは消す */
function prunePresses(presses: Readonly<Record<number, number>>, index: number, start: number): Record<number, number> {
  const out: Record<number, number> = {};
  for (const [k, f] of Object.entries(presses)) if (Number(k) > index && f >= start) out[Number(k)] = f;
  return out;
}

/**
 * 1 フレーム進める。moves は resolveRecipe の結果。
 * - 手が当たるフレーム: 技が持続の 1 フレーム目（frozen でない）で、その技が待っている手の一覧に入っている
 * - 1 手目: 当たったら成功。2 手以上のレシピは、相手に当たった（contact がある）ときだけ。1 手だけなら、そこで完走
 * - 2 手目から: 技が始まったフレームに、手の一覧にない技なら失敗（違う技）。手の技が当たるフレームで、
 *   相手が硬直中（前のフレームでヒット硬直、残り 1 より大きい）なら成功、そうでなければ失敗（遅い）。
 *   手の技が始まる前に相手が動けるようになったら失敗（押していたのに先行入力が消えていたら早い、そうでなければ遅い）
 * - 完走・失敗のあとは 1 手目を待つ状態に戻る
 */
export function stepSimTrial(
  state: SimTrialState,
  moves: readonly (readonly MoveFrames[])[],
  f: SimFrame,
  inputBuffer: number,
): { state: SimTrialState; event: SimTrialEvent | null } {
  const { after } = f;
  const move = after.move;

  // 2 手目以降の技が先行入力に入ったフレームを覚える（1 手目の前でも覚える。使うときに 1 手目の発生より前のものは捨てる）
  let presses = state.presses;
  const buffered = after.buffered;
  if (buffered !== null && buffered.age === 0) {
    for (let k = 1; k < moves.length; k++) {
      if (moves[k]?.includes(buffered.move)) presses = { ...presses, [k]: f.frame };
    }
  }
  const kept: SimTrialState = presses === state.presses ? state : { ...state, presses };

  const hitNow = after.phase === 'active' && after.frame === 0 && move !== null && after.frozen !== true;
  const started = after.phase === 'startup' && after.frame === 0 && move !== null && after.frozen !== true;
  const initial = initialSimTrial();

  if (state.stepIndex === 0) {
    if (!hitNow || !moves[0]?.includes(move)) return { state: kept, event: null };
    if (moves.length === 1) return { state: initial, event: { type: 'complete', stepIndex: 0, timing: null } };
    if (f.contact === null) return { state: kept, event: null };
    return {
      state: { stepIndex: 1, prev: { frame: f.frame, move }, presses: prunePresses(presses, 0, f.frame - move.startup), startPress: null },
      event: { type: 'hit', stepIndex: 0, timing: null },
    };
  }

  const k = state.stepIndex;
  const list = moves[k] ?? [];
  const prev = state.prev;
  if (prev === null) return { state: initial, event: null };
  const drop = (reason: 'early' | 'late' | 'wrong', frames: number | null): { state: SimTrialState; event: SimTrialEvent } => ({
    state: initial,
    event: { type: 'drop', stepIndex: k, reason, frames },
  });

  if (started && !list.includes(move)) return drop('wrong', null);

  if (started) {
    // 押したフレーム: その技が前のフレームの予約か先行入力から出たなら、先行入力に入った記録。
    // 動ける状態や窓の中で押してすぐ出たなら出たフレーム（古い記録や、ほかの技に上書きされた記録は使わない）
    const recorded = presses[k];
    // 先行入力は出す前に 1 古くなり、inputBuffer を超えたら消える（予約 cancelTo は年齢で消えない）
    const b = f.before.buffered;
    const fromBuffer = f.before.cancelTo === move || (b !== null && b.move === move && b.age + 1 <= inputBuffer);
    const press = recorded !== undefined && recorded <= f.frame && fromBuffer ? recorded : f.frame;
    return { state: { ...kept, startPress: press }, event: null };
  }

  if (hitNow && list.includes(move)) {
    const start = f.frame - move.startup;
    const canceled = after.canceled === true;
    const { earliest, last } = timingWindow(prev, move, canceled);
    const connected = f.dummyBefore.phase === 'hitstun' && f.dummyBefore.remaining > 1;
    if (!connected) return drop('late', start - last);
    const press = state.startPress ?? start;
    const timing = { offset: press - earliest, window: last - earliest + 1 };
    if (k === moves.length - 1) return { state: initial, event: { type: 'complete', stepIndex: k, timing } };
    return {
      state: { stepIndex: k + 1, prev: { frame: f.frame, move }, presses: prunePresses(presses, k, start), startPress: null },
      event: { type: 'hit', stepIndex: k, timing },
    };
  }

  // 手の技が始まる前に、相手が動けるようになった
  if (f.dummyAfter.phase === 'free' && !(after.phase === 'startup' && move !== null)) {
    const recorded = presses[k];
    if (recorded === undefined) return drop('late', null);
    // キャンセル先の技は、当たった次のフレーム（c + 1）に先行入力が届く押しから数える。
    // それより遅い押し（窓が閉じたあとの押しなど）は、目押しの最速から数える
    const cancelable = list.some((m) => prev.move.cancels?.includes(m.input) ?? false);
    const viaCancel = prev.frame + 1 - inputBuffer - recorded;
    const early = cancelable && viaCancel > 0 ? viaCancel : timingWindow(prev, prev.move, false).earliest - inputBuffer - recorded;
    return drop('early', early > 0 ? early : null);
  }
  return { state: kept, event: null };
}
