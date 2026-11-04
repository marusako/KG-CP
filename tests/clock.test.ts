import { describe, expect, it } from 'vitest';
import { FRAME_MS, createFrameClock, dueFrames, frameEnd } from '../src/core/clock';

describe('clock (受け入れ条件 1)', () => {
  it('FRAME_MS は 1000/60', () => {
    expect(FRAME_MS).toBeCloseTo(1000 / 60, 10);
  });

  it('createFrameClock は origin = firstNow - FRAME_MS/2、next = 0', () => {
    const c = createFrameClock(1000);
    expect(c.origin).toBeCloseTo(1000 - FRAME_MS / 2, 10);
    expect(c.next).toBe(0);
  });

  it('frameEnd は origin + (n+1)*FRAME_MS', () => {
    const c = createFrameClock(1000);
    expect(frameEnd(c, 0)).toBeCloseTo(c.origin + FRAME_MS, 10);
    expect(frameEnd(c, 4)).toBeCloseTo(c.origin + 5 * FRAME_MS, 10);
  });

  it('終わったフレームがなければ空で、時計は進まない', () => {
    const c = createFrameClock(1000);
    const r = dueFrames(c, frameEnd(c, 0) - 0.5, 30);
    expect(r.frameEnds).toEqual([]);
    expect(r.stalled).toBe(false);
    expect(r.clock.next).toBe(0);
    expect(r.clock.origin).toBe(c.origin);
  });

  it('境目ちょうど (終わりの時刻 == now) は終わった扱い', () => {
    const c = createFrameClock(1000);
    const now = frameEnd(c, 0);
    const r = dueFrames(c, now, 30);
    expect(r.frameEnds).toEqual([now]);
    expect(r.clock.next).toBe(1);
    expect(r.stalled).toBe(false);
  });

  it('境目のわずか手前では終わっていない', () => {
    const c = createFrameClock(1000);
    const r = dueFrames(c, frameEnd(c, 0) - 1e-6, 30);
    expect(r.frameEnds).toEqual([]);
    expect(r.clock.next).toBe(0);
  });

  it('複数フレームを古い順に全部返し、next が数だけ増える', () => {
    const c = createFrameClock(1000);
    const now = frameEnd(c, 2);
    const r = dueFrames(c, now, 30);
    expect(r.frameEnds).toEqual([frameEnd(c, 0), frameEnd(c, 1), frameEnd(c, 2)]);
    expect(r.clock.next).toBe(3);
    expect(r.clock.origin).toBe(c.origin);
  });

  it('next が 0 でない時計からは next から続けて返す', () => {
    const c0 = createFrameClock(1000);
    const c = dueFrames(c0, frameEnd(c0, 1), 30).clock;
    expect(c.next).toBe(2);
    const r = dueFrames(c, frameEnd(c0, 3), 30);
    expect(r.frameEnds).toEqual([frameEnd(c0, 2), frameEnd(c0, 3)]);
    expect(r.clock.next).toBe(4);
  });

  it('maxCatchUp ちょうどは止まり扱いにしない', () => {
    const c = createFrameClock(1000);
    const r = dueFrames(c, frameEnd(c, 4), 5);
    expect(r.frameEnds).toHaveLength(5);
    expect(r.stalled).toBe(false);
    expect(r.clock.next).toBe(5);
  });

  it('maxCatchUp を 1 超えたら止まり扱いで、時計は createFrameClock(now) と同じ', () => {
    const c = createFrameClock(1000);
    const now = frameEnd(c, 5);
    const r = dueFrames(c, now, 5);
    expect(r.stalled).toBe(true);
    expect(r.frameEnds).toEqual([]);
    expect(r.clock).toEqual(createFrameClock(now));
  });
});
