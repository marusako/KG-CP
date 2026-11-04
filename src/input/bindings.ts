export const BUTTON_NAMES = ['LP', 'MP', 'HP', 'LK', 'MK', 'HK'] as const;
export const DIRECTION_NAMES = ['up', 'down', 'left', 'right'] as const;
export const ACTIONS = [...DIRECTION_NAMES, ...BUTTON_NAMES] as const;
export type Action = (typeof ACTIONS)[number];

export interface Bindings {
  /** アクション → KeyboardEvent.code */
  keys: Record<Action, string>;
  /** ボタン名 → Gamepad のボタン番号 */
  pad: Record<(typeof BUTTON_NAMES)[number], number>;
}

const STORAGE_KEY = 'kg-cp:bindings';

export function defaultBindings(): Bindings {
  return {
    keys: {
      up: 'KeyW',
      down: 'KeyS',
      left: 'KeyA',
      right: 'KeyD',
      LP: 'KeyU',
      MP: 'KeyI',
      HP: 'KeyO',
      LK: 'KeyJ',
      MK: 'KeyK',
      HK: 'KeyL',
    },
    // 標準配置: 2=X 3=Y 5=RB / 0=A 1=B 7=RT
    pad: { LP: 2, MP: 3, HP: 5, LK: 0, MK: 1, HK: 7 },
  };
}

type PadButtonName = (typeof BUTTON_NAMES)[number];

/** action に code を割り当てる。code を別の操作が使っていたら、その操作に action の元のキーを渡して入れ替える */
export function assignKey(
  keys: Readonly<Record<Action, string>>,
  action: Action,
  code: string,
): { keys: Record<Action, string>; swappedWith: Action | null } {
  const next = { ...keys };
  const other = ACTIONS.find((a) => a !== action && keys[a] === code) ?? null;
  if (other) next[other] = keys[action];
  next[action] = code;
  return { keys: next, swappedWith: other };
}

/** button に index を割り当てる。index を別のボタンが使っていたら、そのボタンに button の元の番号を渡して入れ替える */
export function assignPad(
  pad: Readonly<Record<PadButtonName, number>>,
  button: PadButtonName,
  index: number,
): { pad: Record<PadButtonName, number>; swappedWith: PadButtonName | null } {
  const next = { ...pad };
  const other = BUTTON_NAMES.find((b) => b !== button && pad[b] === index) ?? null;
  if (other) next[other] = pad[button];
  next[button] = index;
  return { pad: next, swappedWith: other };
}

export function loadBindings(): Bindings {
  const base = defaultBindings();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const saved = JSON.parse(raw) as Partial<Bindings>;
    return {
      keys: { ...base.keys, ...(saved.keys ?? {}) },
      pad: { ...base.pad, ...(saved.pad ?? {}) },
    };
  } catch {
    return base;
  }
}

export function saveBindings(b: Bindings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(b));
  } catch {
    // localStorage が使えなくても動作は続ける
  }
}
