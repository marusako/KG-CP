import type { PadFamily } from './padLayout';

export type Device =
  | { kind: 'keyboard' }
  | { kind: 'pad'; index: number; id: string; family: PadFamily };

function same(a: Device, b: Device): boolean {
  if (a.kind === 'keyboard') return b.kind === 'keyboard';
  return b.kind === 'pad' && a.index === b.index;
}

/**
 * pressed はこのフレームで新しく押されたデバイスの一覧。
 * 今のデバイスが含まれていれば変えない（同時に別のデバイスが押されても表示が揺れないように）
 */
export function nextActiveDevice(current: Device, pressed: readonly Device[]): Device {
  const first = pressed[0];
  if (first === undefined) return current;
  return pressed.some((d) => same(d, current)) ? current : first;
}

/** current がパッドで、その index が connected に含まれなければキーボードに戻す。それ以外は current のまま */
export function dropDisconnected(current: Device, connected: readonly number[]): Device {
  if (current.kind === 'pad' && !connected.includes(current.index)) return { kind: 'keyboard' };
  return current;
}
