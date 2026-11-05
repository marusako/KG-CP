import type { Direction, FrameInput } from './types';

/** 帯に出すフレーム数 */
export const METER_LENGTH = 60;

export interface MeterCell {
  dir: Direction;
  /** このフレームで新しく押されたボタン（前のフレームでは押されていない） */
  pressed: readonly string[];
  /** このフレームで押されているボタン */
  held: readonly string[];
}

/** history の最後から length フレーム分のマス（古い順）。足りなければ、ある分だけ */
export function meterCells(history: readonly FrameInput[], length: number = METER_LENGTH): MeterCell[] {
  const start = Math.max(0, history.length - length);
  const cells: MeterCell[] = [];
  for (let i = start; i < history.length; i++) {
    const cur = history[i] as FrameInput;
    // 範囲の外（1 つ前のフレーム）も見る。history の最初のフレームは前がないので、すべて新しく押された扱い
    const before = i > 0 ? (history[i - 1] as FrameInput).buttons : [];
    cells.push({
      dir: cur.dir,
      pressed: cur.buttons.filter((b) => !before.includes(b)),
      held: cur.buttons,
    });
  }
  return cells;
}

export interface MeterRun {
  dir: Direction;
  /** 何フレーム続いたか */
  frames: number;
  /** この区間の中で新しく押されたボタン（押された順、重なりなし） */
  pressed: readonly string[];
}

/** 同じ方向が続く区間にまとめる（古い順）。ボタンが押されても区間は切らない */
export function meterRuns(cells: readonly MeterCell[]): MeterRun[] {
  const runs: { dir: Direction; frames: number; pressed: string[] }[] = [];
  for (const c of cells) {
    let run = runs[runs.length - 1];
    if (run === undefined || run.dir !== c.dir) {
      run = { dir: c.dir, frames: 0, pressed: [] };
      runs.push(run);
    }
    run.frames++;
    for (const b of c.pressed) if (!run.pressed.includes(b)) run.pressed.push(b);
  }
  return runs;
}

export type MeterMode = 'freeze' | 'live';

export interface MeterState {
  mode: MeterMode;
  /** 表示しているマス */
  cells: readonly MeterCell[];
}

export const INITIAL_METER: MeterState = { mode: 'freeze', cells: [] };

/**
 * 1 フレーム進める（history の最後がいまのフレーム）。
 * live: いつも最新の length フレームを出す。
 * freeze: いまのフレームでボタンが新しく押されたときだけ、最新の length フレームに入れ替える。それ以外は前のまま
 */
export function stepMeter(
  state: MeterState,
  history: readonly FrameInput[],
  length: number = METER_LENGTH,
): MeterState {
  if (state.mode === 'live') return { ...state, cells: meterCells(history, length) };
  // freeze で押していないフレームが大半なので、先に最後の 2 フレームだけで「新しく押したか」を見る。
  // 押していなければマスを作らずに同じ state を返す（main.ts はそれで描き直しを省く）
  if (!pressedNow(history)) return state;
  return { ...state, cells: meterCells(history, length) };
}

/** history の最後のフレームで、1 つ前にはなかったボタンが押されたか（1 フレーム目のボタンは押されたとする） */
function pressedNow(history: readonly FrameInput[]): boolean {
  const cur = history[history.length - 1];
  if (cur === undefined) return false;
  const prev = history[history.length - 2];
  return cur.buttons.some((b) => !(prev?.buttons.includes(b) ?? false));
}

/** モードだけ変える。cells はそのまま */
export function setMeterMode(state: MeterState, mode: MeterMode): MeterState {
  return { ...state, mode };
}
