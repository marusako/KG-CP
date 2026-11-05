import type { FighterState } from './fighter';

export type MoveMeterKind = 'free' | 'startup' | 'active' | 'recovery' | 'jump';

/** 帯の長さの上限（マス） */
export const MOVE_METER_LENGTH = 120;

/** 状態からマスの種類。idle・crouch・walk は 'free'、prejump・air・landing は 'jump' */
export function meterKindOf(state: FighterState): MoveMeterKind {
  switch (state.phase) {
    case 'startup':
    case 'active':
    case 'recovery':
      return state.phase;
    case 'prejump':
    case 'air':
    case 'landing':
      return 'jump';
    default:
      return 'free';
  }
}

export interface MoveMeterState {
  cells: readonly MoveMeterKind[];
  /** 技が終わって止まっているとき true（次の技まで帯を残す） */
  frozen: boolean;
}

function isMoveKind(k: MoveMeterKind): boolean {
  return k === 'startup' || k === 'active' || k === 'recovery';
}

/**
 * 1 フレーム進める。技を出し始めたら帯を空にして積み始め、技が終わって 'free' になったら止める（次の技まで残す）。
 * 技を出していない間は何もしない（同じ state を返す）。長さは 120 マスまで
 */
export function stepMoveMeter(state: MoveMeterState, prev: FighterState, next: FighterState): MoveMeterState {
  const kind = meterKindOf(next);
  if (isMoveKind(kind)) {
    const started = next.phase === 'startup' && next.frame === 0;
    const cells = started ? [kind] : [...state.cells, kind];
    return { cells: cells.length > MOVE_METER_LENGTH ? cells.slice(cells.length - MOVE_METER_LENGTH) : cells, frozen: false };
  }
  // 技が終わった瞬間だけ止める。それ以外は同じ state
  if (!state.frozen && isMoveKind(meterKindOf(prev))) return { cells: state.cells, frozen: true };
  return state;
}
