import type { Direction, FrameInput } from './types';

export interface MeterCell {
  dir: Direction;
  /** このフレームで新しく押されたボタン（前のフレームでは押されていない） */
  pressed: readonly string[];
  /** このフレームで押されているボタン */
  held: readonly string[];
}

/** history の最後から length フレーム分のマス（古い順）。足りなければ、ある分だけ */
export function meterCells(history: readonly FrameInput[], length: number): MeterCell[] {
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
