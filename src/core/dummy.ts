import type { FighterState } from './fighter';
import { formatAdvantage, type Contact } from './contact';
import { contactReaction, type DummyMode } from './frameData';

// Contact と formatAdvantage は、i18n/messages.ts からも読めるよう contact.ts にある（dummy → fighter → messages の循環を避けるため）
export { formatAdvantage };
export type { Contact };

export type DummyPhase = 'free' | 'hitstun' | 'blockstun' | 'down';

/** 相手（その場に立っているだけの的）の状態 */
export interface DummyState {
  phase: DummyPhase;
  /** このフレームを含めて、あと何フレーム続くか（free は 0） */
  remaining: number;
}

export const INITIAL_DUMMY: DummyState = { phase: 'free', remaining: 0 };

/**
 * 1 フレーム進める。dummy は前のフレームの相手、fighter はこのフレームのキャラ（stepFighter のあと）。
 * - 技は持続の 1 フレーム目（phase 'active' かつ frame 0）に必ず当たる（距離は考えない）。
 *   ただし相手がダウン中、またはその切り替えで技の反応のデータがない（contactReaction が null）なら当たらない
 * - 当たったら、相手は反応の種類と長さになり（硬直中でも足さずに置き換える）、fighter には contact の印を付ける。
 *   combo は、前のフレームの相手が同じ種類の硬直（ヒットなら hitstun、ガードなら blockstun）で、まだ 1 フレームより長く残っていたとき
 * - 当たらなければ、相手の remaining を 1 減らし、0 になったら free
 * - 変わらないときは同じ dummy・同じ fighter を返す
 */
export function stepDummy(
  dummy: DummyState,
  fighter: FighterState,
  mode: DummyMode,
): { dummy: DummyState; fighter: FighterState; contact: Contact | null } {
  const move = fighter.move;
  const reaction =
    fighter.phase === 'active' && fighter.frame === 0 && move !== null && dummy.phase !== 'down'
      ? contactReaction(move, mode)
      : null;
  if (reaction !== null) {
    const sameStun = dummy.phase === (mode === 'hit' ? 'hitstun' : 'blockstun');
    return {
      dummy: { phase: reaction.kind, remaining: reaction.frames },
      fighter: { ...fighter, contact: true },
      contact: {
        kind: mode,
        knockdown: reaction.kind === 'down',
        combo: sameStun && dummy.remaining > 1,
        advantage: reaction.advantage,
      },
    };
  }
  if (dummy.phase === 'free') return { dummy, fighter, contact: null };
  const remaining = dummy.remaining - 1;
  return {
    dummy: remaining <= 0 ? INITIAL_DUMMY : { phase: dummy.phase, remaining },
    fighter,
    contact: null,
  };
}
