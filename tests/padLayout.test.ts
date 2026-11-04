import { describe, expect, it } from 'vitest';
import { detectPadFamily, padButtonLabel, padDisplayName } from '../src/input/padLayout';

describe('detectPadFamily (受け入れ条件 1)', () => {
  it('Chrome 形式の id を見分ける', () => {
    expect(
      detectPadFamily('DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)', 'standard'),
    ).toBe('playstation');
    expect(detectPadFamily('Xbox 360 Controller (XInput STANDARD GAMEPAD)', 'standard')).toBe('xbox');
  });

  it('Firefox 形式の id を見分ける', () => {
    expect(detectPadFamily('54c-ce6-DualSense Wireless Controller', 'standard')).toBe('playstation');
    expect(detectPadFamily('45e-28e-Microsoft X-Box 360 pad', 'standard')).toBe('xbox');
  });

  it('ベンダー ID だけでも見分ける', () => {
    expect(detectPadFamily('Some Pad (Vendor: 054c Product: 0000)', 'standard')).toBe('playstation');
    expect(detectPadFamily('Some Pad (Vendor: 045e Product: 0000)', 'standard')).toBe('xbox');
    expect(detectPadFamily('054c-0000-Some Pad', 'standard')).toBe('playstation');
    expect(detectPadFamily('045e-0000-Some Pad', 'standard')).toBe('xbox');
  });

  it('名前の言葉だけで見分ける', () => {
    expect(detectPadFamily('Wireless DualShock 4', 'standard')).toBe('playstation');
    expect(detectPadFamily('My PlayStation Pad', 'standard')).toBe('playstation');
    expect(detectPadFamily('Generic Xbox Pad', 'standard')).toBe('xbox');
    expect(detectPadFamily('Generic XInput Pad', 'standard')).toBe('xbox');
  });

  it('大文字小文字を区別しない', () => {
    expect(detectPadFamily('DUALSENSE', 'standard')).toBe('playstation');
    expect(detectPadFamily('xbox one', 'standard')).toBe('xbox');
    expect(detectPadFamily('Pad (VENDOR: 054C)', 'standard')).toBe('playstation');
    expect(detectPadFamily('45E-28E-PAD', 'standard')).toBe('xbox');
  });

  it('両方に当てはまるときは PlayStation を優先する', () => {
    expect(detectPadFamily('Xbox style DualSense', 'standard')).toBe('playstation');
    expect(detectPadFamily('Pad xinput (Vendor: 054c)', 'standard')).toBe('playstation');
  });

  it('どちらでもなければ unknown', () => {
    expect(detectPadFamily('Generic USB Joystick', 'standard')).toBe('unknown');
    expect(detectPadFamily('', 'standard')).toBe('unknown');
  });

  it("mapping が 'standard' でなければ unknown", () => {
    expect(detectPadFamily('DualSense Wireless Controller', '')).toBe('unknown');
    expect(detectPadFamily('Xbox 360 Controller (XInput STANDARD GAMEPAD)', '')).toBe('unknown');
    expect(detectPadFamily('54c-ce6-DualSense Wireless Controller', 'other')).toBe('unknown');
  });
});

describe('padButtonLabel (受け入れ条件 2)', () => {
  const table: [number, string, string][] = [
    [0, 'A', '×'],
    [1, 'B', '○'],
    [2, 'X', '□'],
    [3, 'Y', '△'],
    [4, 'LB', 'L1'],
    [5, 'RB', 'R1'],
    [6, 'LT', 'L2'],
    [7, 'RT', 'R2'],
    [8, 'View', 'Create'],
    [9, 'Menu', 'Options'],
    [10, 'LS', 'L3'],
    [11, 'RS', 'R3'],
    [12, '↑', '↑'],
    [13, '↓', '↓'],
    [14, '←', '←'],
    [15, '→', '→'],
    [16, 'Xbox', 'PS'],
  ];

  for (const [i, x, p] of table) {
    it(`番号 ${i}: xbox=${x} / playstation=${p}`, () => {
      expect(padButtonLabel('xbox', i)).toBe(x);
      expect(padButtonLabel('playstation', i)).toBe(p);
    });
  }

  it('17 は playstation だけ「タッチパッド」、xbox は表にない', () => {
    expect(padButtonLabel('playstation', 17)).toBe('タッチパッド');
    expect(padButtonLabel('xbox', 17)).toBe('ボタン 17');
  });

  it('表にない番号は「ボタン N」', () => {
    expect(padButtonLabel('xbox', 18)).toBe('ボタン 18');
    expect(padButtonLabel('playstation', 18)).toBe('ボタン 18');
    expect(padButtonLabel('xbox', 99)).toBe('ボタン 99');
  });

  it('unknown は全番号で「ボタン N」', () => {
    for (const i of [0, 3, 12, 16, 17, 18]) {
      expect(padButtonLabel('unknown', i)).toBe(`ボタン ${i}`);
    }
  });
});

describe('padDisplayName (受け入れ条件 10)', () => {
  it('Chrome 形式は最初の " (" より前', () => {
    expect(padDisplayName('DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)')).toBe(
      'DualSense Wireless Controller',
    );
    expect(padDisplayName('Xbox 360 Controller (XInput STANDARD GAMEPAD)')).toBe('Xbox 360 Controller');
  });

  it('Firefox 形式は先頭の「16 進-16 進-」より後', () => {
    expect(padDisplayName('54c-ce6-DualSense Wireless Controller')).toBe('DualSense Wireless Controller');
  });

  it('取り出した結果が空なら id のまま', () => {
    expect(padDisplayName('(STANDARD GAMEPAD)')).toBe('(STANDARD GAMEPAD)');
  });
});
