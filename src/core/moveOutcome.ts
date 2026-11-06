import type { FighterState } from './fighter';
import type { MoveFrames } from './frameData';
import { parseStep, stepInputMatches } from './notation';
import type { NotationRules } from './notation';
import type { PracticeDef } from './types';

/** コマンド練習の試しで、キャラが実際に出した技（または出なかったこと） */
export type MoveOutcome =
  | { kind: 'move'; move: MoveFrames; via: 'direct' | 'buffer' | 'cancel' }
  | { kind: 'none'; reason: 'noMove' | 'air' | 'bufferLost' };

export type OutcomeState =
  | { kind: 'idle' }
  /** 先行入力に入った技が出るのを待っている */
  | { kind: 'pending'; move: MoveFrames };

export const IDLE_OUTCOME: OutcomeState = { kind: 'idle' };

/** 技が始まったフレームか（フレームメーターと同じ見分け方） */
function startedMove(s: FighterState): MoveFrames | null {
  return s.phase === 'startup' && s.frame === 0 ? s.move : null;
}

/**
 * 1 フレーム進める。before・after はそのフレームの前後のキャラ（after は stepDummy のあと）。
 * attempt は、このフレームで試しがあった（analyzeAttempt が結果を返した）か。
 * 結果が決まったフレームだけ outcome を返す（決まらなければ null）
 */
export function stepMoveOutcome(
  state: OutcomeState,
  before: FighterState,
  after: FighterState,
  attempt: boolean,
): { state: OutcomeState; outcome: MoveOutcome | null } {
  const started = startedMove(after);
  if (attempt) {
    // 新しい試しが来たら、待っていた前の試しは捨てる
    if (started !== null) {
      // 直前のフレームの予約から出た技なら、この試しの入力は予約の技に置き換わって消えている
      if (before.cancelTo === started) {
        return { state: IDLE_OUTCOME, outcome: { kind: 'none', reason: 'bufferLost' } };
      }
      return { state: IDLE_OUTCOME, outcome: { kind: 'move', move: started, via: after.canceled ? 'cancel' : 'direct' } };
    }
    if (after.buffered !== null && after.buffered.age === 0) {
      return { state: { kind: 'pending', move: after.buffered.move }, outcome: null };
    }
    const reason = before.phase === 'prejump' || before.phase === 'air' ? 'air' : 'noMove';
    return { state: IDLE_OUTCOME, outcome: { kind: 'none', reason } };
  }
  if (state.kind === 'pending') {
    if (started === state.move && (before.buffered?.move === started || before.cancelTo === started)) {
      return { state: IDLE_OUTCOME, outcome: { kind: 'move', move: started, via: after.canceled ? 'cancel' : 'buffer' } };
    }
    // 待っている技が、先行入力にも予約にも残っていなければ、出ないまま消えた
    if (after.buffered?.move !== state.move && after.cancelTo !== state.move) {
      return { state: IDLE_OUTCOME, outcome: { kind: 'none', reason: 'bufferLost' } };
    }
  }
  return { state, outcome: null };
}

/** 技（フレームデータ）が、コマンド練習で選んだ技（PracticeDef）に当たるか。派生の項目は、派生の技（236LP>K など）が当たる */
export function moveMatchesCommand(move: MoveFrames, command: PracticeDef, rules: NotationRules): boolean {
  const r = parseStep(move.input, rules);
  if (!r.ok) return false;
  if (command.kind === 'followUp') {
    const wide = parseStep(command.notation, rules);
    return wide.ok && stepInputMatches(move.input, r.input, wide.input);
  }
  if (r.input.kind !== 'command') return false;
  const { command: own, buttons } = r.input;
  return own.notation === command.notation && buttons.every((b) => command.buttons.includes(b));
}
