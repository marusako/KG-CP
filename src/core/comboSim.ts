// コンボトライアルを「相手に当たってつながったか」で判定する（第15段階）。
// キャラと相手の動きは、フレームメーターと同じ stepFighter・stepDummy の結果（SimFrame）をそのまま使う。
import type { ComboRecipe, StepInput } from './combo';
import type { Contact } from './contact';
import type { DummyState } from './dummy';
import type { FighterState } from './fighter';
import { contactReaction, followUpLink } from './frameData';
import type { FighterData, MoveFrames } from './frameData';
import { parseStep, stepInputMatches } from './notation';
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

/** 技が手に当たるか（決まりは stepInputMatches）。派生の技（236K~P など）は派生の手にだけ当たる */
export function moveMatchesStep(move: MoveFrames, input: StepInput, rules: NotationRules): boolean {
  const parsed = parseStep(move.input, rules);
  return parsed.ok && stepInputMatches(move.input, parsed.input, input);
}

/**
 * レシピの手ごとに、当たる技の一覧。新しい判定にできなければ null（入力の窓で判定する）。
 * できないのは、当たる技が 1 つもない手があるとき、と、最後でない手に、ヒットで相手がヒット硬直にならない技
 * （反応のデータがない技・ダウンする技・攻撃なしの技。そのあとの手はつながらない）があるとき。最後の手でも、攻撃なしの技（noHitbox）しか当たらない手があれば null
 * 派生の手（236K~P など）の技の一覧は、派生の技（親の技は入らない）
 */
export function resolveRecipe(
  recipe: ComboRecipe,
  data: FighterData,
  rules: NotationRules,
): readonly (readonly MoveFrames[])[] | null {
  const lists: MoveFrames[][] = [];
  const candidates = [...data.moves, ...data.moves.flatMap((m) => (m.followUps ?? []).map((f) => f.move))];
  for (const [i, step] of recipe.steps.entries()) {
    const list = candidates.filter((m) => moveMatchesStep(m, step.input, rules));
    if (list.length === 0) return null;
    const isLast = i === recipe.steps.length - 1;
    // 攻撃のない技（noHitbox）しか当たらない手は、最後の手でも「つながった」にならない
    if (list.every((m) => m.noHitbox === true)) return null;
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
  /**
   * 待っている手が派生のとき、その親の技が始まったフレームと、当たったフレーム（まだなら null）。
   * 親の技が前の手でないとき（手の間に出る親の技）の、受付の始まりを数える元
   */
  readonly base: { readonly start: number; readonly contact: number | null } | null;
}

export function initialSimTrial(): SimTrialState {
  return { stepIndex: 0, prev: null, presses: {}, startPress: null, base: null };
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

/**
 * 派生の技 move が当たるときの、受付の最速（受付の始まりのフレーム）と猶予（受付の長さ）。
 * 受付 frames は親の技が始まったフレームから from − 1 フレーム後が始まり、猶予は to − from + 1。
 * 受付の途中で親の技が当たって止まると、実際に押せる長さはヒットストップの分だけ長くなるが、ここでは数えない
 * （ブリジットの 236K は受付の始まりが当たるフレームと同じ。今のデータでは、相手の硬直が先に切れるので表示はずれない）。
 * 受付 contact は親の技が当たったフレームが始まり。親が前の手（prev）なら prev から、そうでなければ base（親の技の途中の記録）から数える
 */
function followTiming(
  state: SimTrialState,
  prev: { frame: number; move: MoveFrames },
  move: MoveFrames,
  start: number,
): { earliest: number; window: number } | null {
  const link = followUpLink(move);
  if (link === undefined) return null;
  const base = state.base ?? (prev.move === link.parent ? { start: prev.frame - prev.move.startup, contact: prev.frame } : null);
  const w = link.followUp.window;
  if (w.kind === 'frames') return { earliest: base === null ? start : base.start + w.from - 1, window: w.to - w.from + 1 };
  return { earliest: base?.contact ?? start, window: w.frames };
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
 * - 2 手目から: 技が始まったフレームに、手の一覧にない技なら失敗（違う技。手が派生なら、その親の技が始まっても違う技にしない）。手の技が当たるフレームで、
 *   相手が硬直中（前のフレームでヒット硬直、残り 1 より大きい）なら成功、そうでなければ失敗（遅い）。
 *   手の技が始まる前に相手が動けるようになったら失敗（押していたのに先行入力が消えていたら早い、そうでなければ遅い）
 * - 手が派生のとき、押したフレームは派生のボタンの押し（ヒットストップ中の予約は、予約に入ったフレーム）。
 *   最速・猶予は受付（followTiming）。相手が硬直中かで、つながったか決める
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
  // 派生は、ヒットストップ中に予約に入ったフレームを押したフレームにする（予約の技は、手の一覧にある派生の技）
  const reserved = after.cancelTo;
  if (reserved !== undefined && f.before.cancelTo !== reserved && followUpLink(reserved) !== undefined) {
    for (let k = 1; k < moves.length; k++) {
      // 当たったフレームに押した派生は、次のフレームで予約になる（押したのは 1 つ前のフレーム）
      if (moves[k]?.includes(reserved)) presses = { ...presses, [k]: f.frame - (after.followFromPrev === true ? 1 : 0) };
    }
  }
  let kept: SimTrialState = presses === state.presses ? state : { ...state, presses };

  const hitNow = after.phase === 'active' && after.frame === 0 && move !== null && after.frozen !== true;
  const started = after.phase === 'startup' && after.frame === 0 && move !== null && after.frozen !== true;
  const initial = initialSimTrial();

  if (state.stepIndex === 0) {
    if (!hitNow || !moves[0]?.includes(move)) return { state: kept, event: null };
    if (moves.length === 1) return { state: initial, event: { type: 'complete', stepIndex: 0, timing: null } };
    if (f.contact === null) return { state: kept, event: null };
    return {
      state: { stepIndex: 1, prev: { frame: f.frame, move }, presses: prunePresses(presses, 0, f.frame - move.startup), startPress: null, base: null },
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

  // 手が派生なら、その親の技が始まっても違う技にしない（親の技は手の一部）。始まりと当たりを覚えておく
  const isParent = move !== null && list.some((m) => followUpLink(m)?.parent === move);
  if (started && !list.includes(move)) {
    if (!isParent) return drop('wrong', null);
    return { state: { ...kept, base: { start: f.frame, contact: null } }, event: null };
  }
  if (hitNow && isParent && f.contact !== null && state.base !== null && state.base.contact === null) {
    kept = { ...kept, base: { ...state.base, contact: f.frame } };
  }

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
    const follow = followTiming(state, prev, move, start);
    const { earliest, last } = follow === null ? timingWindow(prev, move, canceled) : { earliest: follow.earliest, last: follow.earliest + follow.window - 1 };
    const connected = f.dummyBefore.phase === 'hitstun' && f.dummyBefore.remaining > 1;
    if (!connected) return drop('late', follow === null ? start - last : null);
    const press = state.startPress ?? start;
    const timing = { offset: press - earliest, window: last - earliest + 1 };
    if (k === moves.length - 1) return { state: initial, event: { type: 'complete', stepIndex: k, timing } };
    return {
      state: { stepIndex: k + 1, prev: { frame: f.frame, move }, presses: prunePresses(presses, k, start), startPress: null, base: null },
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
