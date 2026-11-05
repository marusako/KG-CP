import { msg } from '../i18n/messages';

export type PadFamily = 'xbox' | 'playstation' | 'unknown';

/** Gamepad.id と mapping からパッドの系統を推定する。標準の配置でなければ番号の意味が決まっていないので unknown */
export function detectPadFamily(id: string, mapping: string): PadFamily {
  if (mapping !== 'standard') return 'unknown';
  const s = id.toLowerCase();
  if (/vendor:\s*054c/.test(s) || /^0?54c-/.test(s) || /dualsense|dualshock|playstation/.test(s)) return 'playstation';
  if (/vendor:\s*045e/.test(s) || /^0?45e-/.test(s) || /xbox|xinput/.test(s)) return 'xbox';
  return 'unknown';
}

const XBOX: readonly string[] = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Menu', 'LS', 'RS', '↑', '↓', '←', '→', 'Xbox'];
const PLAYSTATION = (): readonly string[] => [
  '×', '○', '□', '△', 'L1', 'R1', 'L2', 'R2', 'Create', 'Options', 'L3', 'R3', '↑', '↓', '←', '→', 'PS', msg().touchpad,
];

/** 標準の配置でのボタン番号の表示名。分からなければ「ボタン N」 */
export function padButtonLabel(family: PadFamily, index: number): string {
  const table = family === 'xbox' ? XBOX : family === 'playstation' ? PLAYSTATION() : [];
  return table[index] ?? msg().padButtonN(index);
}

/** Gamepad.id から読みやすい名前を取り出す（Chrome は括弧より前、Firefox は先頭の ID 2 つより後）。取れなければ id のまま */
export function padDisplayName(id: string): string {
  const firefox = /^[0-9a-f]+-[0-9a-f]+-(.+)$/i.exec(id);
  const base = (firefox?.[1] ?? id).replace(/\s*\(.*$/, '').trim();
  return base === '' ? id : base;
}
