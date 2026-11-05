import { msg } from '../i18n/messages';

const fixedLabels = (): Readonly<Record<string, string>> => ({
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  Space: 'Space', ShiftLeft: msg().leftShift, ShiftRight: msg().rightShift,
  ControlLeft: msg().leftCtrl, ControlRight: msg().rightCtrl, Enter: 'Enter',
});

/** KeyboardEvent.code を画面に出す名前にする。決まりのないものは code のまま */
export function keyLabel(code: string): string {
  const fixed = fixedLabels()[code];
  if (fixed) return fixed;
  const key = /^Key([A-Z])$/.exec(code);
  if (key) return key[1]!;
  const digit = /^Digit([0-9])$/.exec(code);
  if (digit) return digit[1]!;
  const numpad = /^Numpad([0-9])$/.exec(code);
  if (numpad) return msg().numpadKey(numpad[1]!);
  return code;
}
