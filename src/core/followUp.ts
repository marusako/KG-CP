// コマンド練習の派生の項目の判定（第17段階）。派生の入力は、入力の履歴だけでは成否が決まらないので、キャラの動きで決める。
import { movePosition } from './fighter';
import type { FighterState } from './fighter';
import type { FighterData, FollowUp, MoveFrames } from './frameData';
import { followInputMatches, parseStep, stepInputMatches } from './notation';
import type { NotationRules } from './notation';
import type { FollowUpDef, FrameInput } from './types';

export type FollowUpJudge =
  | { ok: true }
  | { ok: false; reason: 'noParent' | 'noContact' | 'other' }
  | { ok: false; reason: 'early' | 'late'; frames: number };

/**
 * 派生のボタンを押したフレームの判定。before・after はそのフレームの前後のキャラ（after は stepDummy のあと）。
 * - after でその派生の技が始まった、または予約（after.cancelTo）になった → ok
 * - before の技が親でない → noParent
 * - 受付 frames: 親の技のフレーム番号 n（止まっていたフレームは数えない。このフレームの分を含む）が from より前 → early（from − n）、to より後 → late（n − to）
 * - 受付の中なのに、選んだ派生が出ていない（別の技が始まった・予約になった。例: 236P>K を選んで 2 + K → 236LP>2K）→ other
 * - 受付 contact: before に contact がない → noContact。contactAge（このフレームの分を含む）が frames を超えた → late（超えた分）
 */
export function judgeFollowUp(before: FighterState, after: FighterState, parent: MoveFrames, followUp: FollowUp): FollowUpJudge {
  const started = after.move === followUp.move && after.phase === 'startup' && after.frame === 0;
  if (started || after.cancelTo === followUp.move) return { ok: true };
  if (before.move !== parent) return { ok: false, reason: 'noParent' };
  const w = followUp.window;
  if (w.kind === 'contact') {
    // 当たったフレームちょうどに押した（次のフレームで予約になる）
    if (after.contact === true && before.contact !== true) return { ok: true };
    if (before.contact !== true) return { ok: false, reason: 'noContact' };
    const age = (before.contactAge ?? 1) + 1;
    return age > w.frames ? { ok: false, reason: 'late', frames: age - w.frames } : { ok: false, reason: 'other' };
  }
  // 親の技が終わって動けるようになっていたら、受付のあと（番号は 1 つ進める）
  const n = after.move === parent ? movePosition(after) + 1 : movePosition(before) + 2;
  if (n < w.from) return { ok: false, reason: 'early', frames: w.from - n };
  if (n > w.to) return { ok: false, reason: 'late', frames: n - w.to };
  return { ok: false, reason: 'other' };
}

/**
 * コマンド練習で選んだ派生の項目（FollowUpDef）の、このフレームの判定。派生の入力（ボタンと方向）が成立したフレームだけ判定し、そうでなければ null。
 * 親の技は、いま出している技が項目の派生を持っていればそれ（236P>K なら 236LP・236MP・236HP のどれでも）、持っていなければ項目に当たる最初の派生の親。
 * history の最後がいまのフレーム。before・after はそのフレームの前後のキャラ（after は stepDummy のあと）
 */
export function judgePracticeFollowUp(
  item: FollowUpDef,
  data: FighterData,
  rules: NotationRules,
  history: readonly FrameInput[],
  before: FighterState,
  after: FighterState,
): FollowUpJudge | null {
  const wide = parseStep(item.notation, rules);
  if (!wide.ok || wide.input.kind !== 'followUp' || !followInputMatches(history, wide.input.follow)) return null;
  const pairs = data.moves.flatMap((parent) =>
    (parent.followUps ?? []).flatMap((followUp) => {
      const own = parseStep(followUp.move.input, rules);
      return own.ok && stepInputMatches(followUp.move.input, own.input, wide.input) ? [{ parent, followUp }] : [];
    }),
  );
  const pair = pairs.find((p) => p.parent === before.move) ?? pairs[0];
  return pair === undefined ? null : judgeFollowUp(before, after, pair.parent, pair.followUp);
}
