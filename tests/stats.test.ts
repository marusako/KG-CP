import { describe, expect, it } from 'vitest';
import { Ring, histogram, summarize } from '../src/core/stats';

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
