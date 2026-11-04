export const FRAME_MS = 1000 / 60;

/** フレーム n は [origin + n*FRAME_MS, origin + (n+1)*FRAME_MS) の時間。next は次に進めるフレームの番号 */
export interface FrameClock {
  readonly origin: number;
  readonly next: number;
}

/** 最初の rAF の時刻から時計を作る。境目が rAF の時刻から遠くなるよう半フレームずらす */
export function createFrameClock(firstNow: number): FrameClock {
  return { origin: firstNow - FRAME_MS / 2, next: 0 };
}

/** フレーム n の終わりの時刻 */
export function frameEnd(clock: FrameClock, n: number): number {
  return clock.origin + (n + 1) * FRAME_MS;
}

/**
 * now までに終わったフレーム（終わりの時刻 <= now）を、clock.next から順に全部返す。
 * その数が maxCatchUp を超えたら、処理が止まっていたとみなして時計を作り直す。
 */
export function dueFrames(
  clock: FrameClock,
  now: number,
  maxCatchUp: number,
): { clock: FrameClock; frameEnds: number[]; stalled: boolean } {
  const frameEnds: number[] = [];
  let n = clock.next;
  while (frameEnd(clock, n) <= now) {
    frameEnds.push(frameEnd(clock, n));
    n++;
    if (frameEnds.length > maxCatchUp) {
      return { frameEnds: [], stalled: true, clock: createFrameClock(now) };
    }
  }
  return { frameEnds, stalled: false, clock: { origin: clock.origin, next: n } };
}
