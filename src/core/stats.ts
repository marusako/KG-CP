/** 空なら null。mean は平均、max は最大 */
export function summarize(values: readonly number[]): { count: number; mean: number; max: number } | null {
  if (values.length === 0) return null;
  let sum = 0;
  let max = -Infinity;
  for (const v of values) {
    sum += v;
    if (v > max) max = v;
  }
  return { count: values.length, mean: sum / values.length, max };
}

/** 0 以上の整数の値を数える。最後の箱は「それ以上」。負の値は 0 番目 */
export function histogram(values: readonly number[], buckets: number): number[] {
  const out = new Array<number>(buckets).fill(0);
  for (const v of values) {
    const i = Math.min(Math.max(v, 0), buckets - 1);
    out[i] = (out[i] ?? 0) + 1;
  }
  return out;
}

/** 直近 capacity 個だけを持つ入れ物 */
export class Ring<T> {
  private items: T[] = [];
  constructor(private readonly capacity: number) {}

  push(v: T): void {
    this.items.push(v);
    if (this.items.length > this.capacity) this.items.shift();
  }

  /** 古い順 */
  values(): T[] {
    return [...this.items];
  }
}
