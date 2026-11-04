import type { GameProfile } from '../core/profiles';
import { bindingsKeys, readFirst } from '../core/storageKeys';

export const DIRECTION_NAMES = ['up', 'down', 'left', 'right'] as const;
export type DirectionName = (typeof DIRECTION_NAMES)[number];
/** 操作の名前（方向の名前か、ボタンの名前） */
export type Action = string;

export interface Bindings {
  /** 操作 → KeyboardEvent.code。方向 4 つとゲームのボタン全部を持つ */
  keys: Record<string, string>;
  /** ボタン → Gamepad のボタン番号。ゲームのボタン全部を持つ */
  pad: Record<string, number>;
}

/** 方向 4 つのあとに、ゲームのボタンを並べたもの */
export function actionsFor(profile: GameProfile): string[] {
  return [...DIRECTION_NAMES, ...profile.buttons];
}

export function defaultBindings(profile: GameProfile): Bindings {
  return { keys: { ...profile.defaultKeys }, pad: { ...profile.defaultPad } };
}

/** action に code を割り当てる。code を別の操作が使っていたら、その操作に action の元のキーを渡して入れ替える */
export function assignKey(
  keys: Readonly<Record<string, string>>,
  action: string,
  code: string,
): { keys: Record<string, string>; swappedWith: string | null } {
  const next = { ...keys };
  const other = Object.keys(keys).find((a) => a !== action && keys[a] === code) ?? null;
  if (other) next[other] = keys[action] as string;
  next[action] = code;
  return { keys: next, swappedWith: other };
}

/** button に index を割り当てる。index を別のボタンが使っていたら、そのボタンに button の元の番号を渡して入れ替える */
export function assignPad(
  pad: Readonly<Record<string, number>>,
  button: string,
  index: number,
): { pad: Record<string, number>; swappedWith: string | null } {
  const next = { ...pad };
  const other = Object.keys(pad).find((b) => b !== button && pad[b] === index) ?? null;
  if (other) next[other] = pad[button] as number;
  next[button] = index;
  return { pad: next, swappedWith: other };
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** 保存した文字列（なければ null）から読む。例外は投げず、おかしな部分は初期値にする */
export function parseBindings(raw: string | null, profile: GameProfile): Bindings {
  const base = defaultBindings(profile);
  if (raw === null) return base;
  let saved: unknown;
  try {
    saved = JSON.parse(raw);
  } catch {
    return base;
  }
  if (!isRecord(saved)) return base;
  const savedKeys = isRecord(saved.keys) ? saved.keys : {};
  const savedPad = isRecord(saved.pad) ? saved.pad : {};
  for (const a of Object.keys(base.keys)) {
    const v = savedKeys[a];
    if (typeof v === 'string' && v !== '') base.keys[a] = v;
  }
  for (const b of Object.keys(base.pad)) {
    const v = savedPad[b];
    if (typeof v === 'number' && Number.isInteger(v) && v >= 0) base.pad[b] = v;
  }
  return base;
}

/** 保存場所は bindingsKeys のとおり（sf6 だけは、なければ前の版のキーも読む） */
export function loadBindings(profile: GameProfile): Bindings {
  try {
    const raw = readFirst((k) => localStorage.getItem(k), bindingsKeys(profile.id).read);
    return parseBindings(raw, profile);
  } catch {
    return defaultBindings(profile);
  }
}

export function saveBindings(profile: GameProfile, b: Bindings): void {
  try {
    localStorage.setItem(bindingsKeys(profile.id).save, JSON.stringify(b));
  } catch {
    // localStorage が使えなくても動作は続ける
  }
}
