import { describe, expect, it } from 'vitest';
import { RafMeter, Ring, histogram, summarize } from '../src/core/stats';

describe('summarize (受け入れ条件 6)', () => {
  it('空配列は null', () => {
    expect(summarize([])).toBeNull();
  });

  it('count・mean・max を返す', () => {
    const s = summarize([1, 2, 6])!;
    expect(s.count).toBe(3);
    expect(s.mean).toBeCloseTo(3, 10);
    expect(s.max).toBe(6);
  });

  it('1 要素', () => {
    expect(summarize([4])).toEqual({ count: 1, mean: 4, max: 4 });
  });

  it('負の値だけでも max は最大値', () => {
    expect(summarize([-5, -2, -9])!.max).toBe(-2);
  });
});

describe('histogram (受け入れ条件 6)', () => {
  it('結果の長さは buckets', () => {
    expect(histogram([], 4)).toEqual([0, 0, 0, 0]);
  });

  it('値ごとに数える', () => {
    expect(histogram([0, 1, 1, 2], 4)).toEqual([1, 2, 1, 0]);
  });

  it('最後の箱は「それ以上」', () => {
    expect(histogram([3, 4, 100], 4)).toEqual([0, 0, 0, 3]);
    expect(histogram([2, 3], 4)).toEqual([0, 0, 1, 1]);
  });

  it('負の値は 0 番目', () => {
    expect(histogram([-1, -100, 0], 3)).toEqual([3, 0, 0]);
  });
});

describe('Ring (受け入れ条件 6)', () => {
  it('空なら空配列', () => {
    expect(new Ring<number>(3).values()).toEqual([]);
  });

  it('capacity 以内なら積んだ順 (古い順)', () => {
    const r = new Ring<number>(3);
    r.push(1);
    r.push(2);
    expect(r.values()).toEqual([1, 2]);
  });

  it('capacity ちょうどでは捨てない', () => {
    const r = new Ring<number>(3);
    [1, 2, 3].forEach((v) => r.push(v));
    expect(r.values()).toEqual([1, 2, 3]);
  });

  it('capacity を超えたら古いものから捨てる', () => {
    const r = new Ring<number>(3);
    [1, 2, 3, 4, 5].forEach((v) => r.push(v));
    expect(r.values()).toEqual([3, 4, 5]);
  });

  it('何周しても古い順', () => {
    const r = new Ring<string>(2);
    ['a', 'b', 'c', 'd', 'e'].forEach((v) => r.push(v));
    expect(r.values()).toEqual(['d', 'e']);
  });
});

describe('RafMeter (受け入れ条件 3)', () => {
  it('最初の onRaf は間隔を記録せず、フレーム数だけ記録する', () => {
    const m = new RafMeter(5);
    m.onRaf(1000, 1, false);
    expect(m.intervals()).toEqual([]);
    expect(m.steps()).toEqual([1]);
  });

  it('2 回目から前の回との差を古い順に記録する', () => {
    const m = new RafMeter(5);
    m.onRaf(1000, 1, false);
    m.onRaf(1016, 1, false);
    m.onRaf(1050, 2, false);
    expect(m.intervals()).toEqual([16, 34]);
    expect(m.steps()).toEqual([1, 1, 2]);
  });

  it('stalled の回は間隔もフレーム数も記録しない', () => {
    const m = new RafMeter(5);
    m.onRaf(1000, 1, false);
    m.onRaf(3000, 0, true);
    expect(m.intervals()).toEqual([]);
    expect(m.steps()).toEqual([1]);
  });

  it('停止の次の回の間隔は、停止した回の時刻との差で記録する', () => {
    const m = new RafMeter(5);
    m.onRaf(1000, 1, false);
    m.onRaf(3000, 0, true);
    m.onRaf(3017, 1, false);
    expect(m.intervals()).toEqual([17]);
    expect(m.steps()).toEqual([1, 1]);
  });

  it('最初の回が stalled でも、次の回の間隔はその時刻との差になる', () => {
    const m = new RafMeter(5);
    m.onRaf(500, 0, true);
    m.onRaf(516, 1, false);
    expect(m.intervals()).toEqual([16]);
    expect(m.steps()).toEqual([1]);
  });

  it('capacity を超えたら古いものから消える (steps と intervals の両方)', () => {
    const m = new RafMeter(3);
    for (let i = 0; i < 6; i++) m.onRaf(1000 + i * 10 + i * i, i, false);
    // 時刻: 1000,1011,1024,1039,1056,1075 → 間隔: 11,13,15,17,19
    expect(m.steps()).toEqual([3, 4, 5]);
    expect(m.intervals()).toEqual([15, 17, 19]);
  });
});
