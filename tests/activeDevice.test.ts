import { describe, expect, it } from 'vitest';
import { nextActiveDevice, type Device } from '../src/input/activeDevice';

const kb: Device = { kind: 'keyboard' };
const pad0: Device = { kind: 'pad', index: 0, id: 'Pad A', family: 'xbox' };
const pad1: Device = { kind: 'pad', index: 1, id: 'Pad B', family: 'playstation' };

describe('nextActiveDevice (受け入れ条件 4)', () => {
  it('pressed が空なら current のまま', () => {
    expect(nextActiveDevice(kb, [])).toBe(kb);
    expect(nextActiveDevice(pad0, [])).toBe(pad0);
  });

  it('current が pressed に含まれていれば current のまま（キーボード）', () => {
    expect(nextActiveDevice(kb, [pad0, { kind: 'keyboard' }])).toBe(kb);
  });

  it('current が pressed に含まれていれば current のまま（パッド・index で比較）', () => {
    expect(nextActiveDevice(pad1, [kb, pad0, pad1])).toBe(pad1);
    // index が同じなら id などが違っても同じパッドとみなす
    const same: Device = { kind: 'pad', index: 1, id: 'Pad B (renamed)', family: 'playstation' };
    expect(nextActiveDevice(pad1, [kb, same])).toBe(pad1);
  });

  it('含まれていなければ pressed[0] に切り替わる', () => {
    expect(nextActiveDevice(kb, [pad0, pad1])).toBe(pad0);
    expect(nextActiveDevice(pad0, [kb, pad1])).toBe(kb);
    expect(nextActiveDevice(pad0, [pad1, kb])).toBe(pad1);
  });

  it('index が違うパッドどうしは別のデバイス', () => {
    expect(nextActiveDevice(pad0, [pad1])).toBe(pad1);
  });
});
