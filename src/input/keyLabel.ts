const FIXED: Readonly<Record<string, string>> = {
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  Space: 'Space', ShiftLeft: '左Shift', ShiftRight: '右Shift',
  ControlLeft: '左Ctrl', ControlRight: '右Ctrl', Enter: 'Enter',
};

/** KeyboardEvent.code を画面に出す名前にする。決まりのないものは code のまま */
export function keyLabel(code: string): string {
  const fixed = FIXED[code];
  if (fixed) return fixed;
  const key = /^Key([A-Z])$/.exec(code);
  if (key) return key[1]!;
  const digit = /^Digit([0-9])$/.exec(code);
  if (digit) return digit[1]!;
  const numpad = /^Numpad([0-9])$/.exec(code);
  if (numpad) return `テンキー${numpad[1]!}`;
  return code;
}
