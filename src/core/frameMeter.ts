import type { FighterState } from './fighter';
import type { MoveFrames } from './frameData';
import { meterCells } from './inputMeter';
import type { Direction, FrameInput } from './types';

/** 上の段のマスの種類 */
export type StateKind = 'free' | 'startup' | 'active' | 'recovery' | 'jump';

/** 状態からマスの種類。idle・crouch・walk は 'free'、prejump・air・landing は 'jump' */
export function meterKindOf(state: FighterState): StateKind {
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

export interface FrameMeterCell {
  state: StateKind;
  dir: Direction;
  /** このフレームで新しく押されたボタン */
  pressed: readonly string[];
  /** このフレームで押されているボタン */
  held: readonly string[];
  /** このフレームで技が始まった（技を出したボタンのマスは、先行入力にしないための印。始まったマスだけ true） */
  moveStart?: true;
}

export interface FrameMeterState {
  cells: readonly FrameMeterCell[];
  /** 帯に積んでいる途中か（false なら止まっていて、前の帯を見せている） */
  recording: boolean;
  /** いまの末尾で、'free' かつボタンを押していないフレームが何フレーム続いているか */
  freeRun: number;
  /** 帯の中で技が始まったマスの位置と技（古い順） */
  starts: readonly { index: number; move: MoveFrames }[];
  /** 帯の先頭の、入力だけの部分（帯を始める前の入力）のマス数。古いほうを捨てると、その分だけ減る */
  lead: number;
  /** 帯の長さの上限を超えて、古いほうのマスを捨てたことがあるか（先頭の区間が途中で切れているかもしれない） */
  cut: boolean;
}

/** 帯の長さの上限。超えたら古いほうから捨てる */
export const FRAME_METER_MAX = 120;
/** 動ける時間がこれだけ続いたら区切る */
export const FRAME_METER_BREAK = 30;
/** 帯を始めるとき、その前の入力を何フレーム分つけるか */
export const FRAME_METER_LEAD = 15;

export const EMPTY_FRAME_METER: FrameMeterState = {
  cells: [],
  recording: false,
  freeRun: 0,
  starts: [],
  lead: 0,
  cut: false,
};

/** history の最後のフレームで、1 つ前にはなかったボタンが押されたか（1 フレーム目のボタンは押されたとする） */
function pressedNow(history: readonly FrameInput[]): boolean {
  const cur = history[history.length - 1];
  if (cur === undefined) return false;
  const prev = history[history.length - 2];
  return cur.buttons.some((b) => !(prev?.buttons.includes(b) ?? false));
}

/**
 * 1 フレーム進める。prev・next はそのフレームの前後のキャラの状態、history の最後がいまのフレーム。
 * - 止まっているとき: ボタンが新しく押されたか、技が始まったら、新しい帯を始める（先頭に、いまより前の入力を
 *   FRAME_METER_LEAD フレームまでつける）。どちらでもなければ同じ state を返す（描き直しを省くため）
 * - 積んでいるとき: いまのフレームのマスを足す。'free' でボタンを押していない状態が FRAME_METER_BREAK フレーム
 *   続いたら止め、その続きの分は帯から取り除く
 */
export function stepFrameMeter(
  state: FrameMeterState,
  _prev: FighterState,
  next: FighterState,
  history: readonly FrameInput[],
): FrameMeterState {
  const started = next.phase === 'startup' && next.frame === 0 && next.move !== null;
  if (!state.recording && !started && !pressedNow(history)) return state;

  const kind = meterKindOf(next);
  // 先頭の入力の部分は 'free'。いまのフレームだけ、キャラの状態の種類にする
  const fresh = meterCells(history, state.recording ? 1 : FRAME_METER_LEAD + 1).map(
    (c, i, all): FrameMeterCell => {
      if (i < all.length - 1) return { ...c, state: 'free' };
      return started ? { ...c, state: kind, moveStart: true } : { ...c, state: kind };
    },
  );
  const base = state.recording ? state : { ...EMPTY_FRAME_METER, recording: true, lead: fresh.length - 1 };
  const cell = fresh[fresh.length - 1] as FrameMeterCell;
  let cells = [...base.cells, ...fresh];
  const starts = started ? [...base.starts, { index: cells.length - 1, move: next.move as MoveFrames }] : base.starts;
  const freeRun = kind === 'free' && cell.held.length === 0 ? base.freeRun + 1 : 0;

  const { lead, cut } = base;
  if (freeRun >= FRAME_METER_BREAK) {
    cells = cells.slice(0, cells.length - FRAME_METER_BREAK);
    return { cells, recording: false, freeRun: 0, starts, lead: Math.min(lead, cells.length), cut };
  }
  if (cells.length > FRAME_METER_MAX) {
    const drop = cells.length - FRAME_METER_MAX;
    cells = cells.slice(drop);
    return {
      cells,
      recording: true,
      freeRun,
      starts: starts.filter((s) => s.index >= drop).map((s) => ({ ...s, index: s.index - drop })),
      lead: Math.max(0, lead - drop),
      cut: true,
    };
  }
  return { cells, recording: true, freeRun, starts, lead, cut };
}

/** 処理が止まったとき: 積んでいる途中なら止める（帯はそのまま残す）。止まっていれば同じ state */
export function stopFrameMeter(state: FrameMeterState): FrameMeterState {
  return state.recording ? { ...state, recording: false } : state;
}

export interface StateSegment {
  state: StateKind;
  start: number;
  length: number;
}

/** 上の段の、同じ種類が続く区間（古い順）。長さの数字を出すのに使う */
export function stateSegments(cells: readonly FrameMeterCell[]): StateSegment[] {
  const segments: StateSegment[] = [];
  cells.forEach((c, i) => {
    const last = segments[segments.length - 1];
    if (last !== undefined && last.state === c.state) last.length++;
    else segments.push({ state: c.state, start: i, length: 1 });
  });
  return segments;
}

/**
 * 先行入力のマス: ボタンが新しく押されたのに、そのマスの state が 'free' でない（技の途中・ジャンプ中に押した）。
 * 技を出したボタンのマス（moveStart）は、そのマスから技が始まるので先行入力ではない
 */
export function isEarlyPress(cell: FrameMeterCell): boolean {
  return cell.pressed.length > 0 && cell.state !== 'free' && cell.moveStart !== true;
}

/**
 * 長さの数字を付ける区間。先頭の入力だけの部分（lead）には付けない。
 * 古いほうを捨てて先頭の区間が途中で切れている（cut で lead が 0）ときは、その区間にも付けない
 */
export function labeledSegments(state: FrameMeterState): StateSegment[] {
  const segments = stateSegments(state.cells.slice(state.lead)).map((s) => ({ ...s, start: s.start + state.lead }));
  return state.cut && state.lead === 0 ? segments.slice(1) : segments;
}

/**
 * 帯が変わったとき、技の文を帯の starts に合わせる（新しい帯なら空から。技が始まったら makeText で 1 つ足す。
 * 古い技が帯から外れたら、その文も捨てる）。文が変わらなければ同じ配列を返す
 */
export function syncMoveTexts(
  texts: readonly string[],
  before: FrameMeterState,
  after: FrameMeterState,
  makeText: (move: MoveFrames) => string,
): readonly string[] {
  if (after === before) return texts;
  // 止まっていた帯から新しい帯になったら、前の帯の文は使わない
  let next: readonly string[] = before.recording ? texts : [];
  const lastStart = after.starts[after.starts.length - 1];
  const startedNow = after.recording && lastStart !== undefined && lastStart.index === after.cells.length - 1;
  if (startedNow) next = [...next, makeText(lastStart.move)];
  next = next.slice(Math.max(0, next.length - after.starts.length));
  return next.length === texts.length && next.every((t, i) => t === texts[i]) ? texts : next;
}
