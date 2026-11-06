import { msg } from '../i18n/messages';
import type { CommandDef, Direction, FrameInput } from './types';

/** 派生の入力（親のあとに入れる部分）。方向がなければ dirs は null（方向は何でもよい） */
export interface FollowInput {
  dirs: readonly Direction[] | null;
  /** 押すボタン。chord が false ならどれか 1 つ（スト6 の K は LK・MK・HK のどれか）、true なら全部の同時押し（LPLK） */
  buttons: readonly string[];
  chord: boolean;
}

export type StepInput =
  | { kind: 'normal'; dirs: readonly Direction[]; buttons: readonly string[] }
  | { kind: 'command'; command: CommandDef; buttons: readonly string[] }
  | {
      kind: 'followUp';
      parent: Exclude<StepInput, { kind: 'followUp' }>;
      follow: FollowInput;
      text: string;
      /** 押した瞬間を見るボタン（follow.buttons と同じ。通常技・コマンドと同じく buttons で読めるように持つ） */
      buttons: readonly string[];
    };

/** ゲームごとの表記のルール */
export interface NotationRules {
  /** ボタンの名前 */
  buttons: readonly string[];
  /** まとめ書き。例: スト6 の 'P' は ['LP','MP','HP']。GG にはない */
  buttonGroups: Readonly<Record<string, readonly string[]>>;
  commands: readonly CommandDef[];
}

/** ボタンの名前（まとめ書きを含む）を、長く一致する順に */
function buttonNames(rules: NotationRules): string[] {
  return [...rules.buttons, ...Object.keys(rules.buttonGroups)].sort((a, b) => b.length - a.length);
}

/**
 * 派生の入力（例: 'P'、'HK'、'LPLK'、'2K'）を読む。先頭の数字は方向（2 はしゃがみの 1・2・3）。
 * ボタンは名前を並べたもの（同時押し）。読めなければ null
 */
export function parseFollowInput(text: string, rules: NotationRules): FollowInput | null {
  const t = text.trim();
  const dirMatch = /^[1-9]/.exec(t);
  const rest = dirMatch === null ? t : t.slice(1);
  let dirs: Direction[] | null = null;
  if (dirMatch !== null) {
    const d = Number(dirMatch[0]) as Direction;
    dirs = d === 2 ? [1, 2, 3] : [d];
  }
  const names = buttonNames(rules);
  const tokens: string[] = [];
  for (let i = 0; i < rest.length; ) {
    const name = names.find((n) => rest.startsWith(n, i));
    if (name === undefined) return null;
    tokens.push(name);
    i += name.length;
  }
  if (tokens.length === 0) return null;
  const buttons: string[] = [];
  for (const token of tokens) {
    const group = Object.hasOwn(rules.buttonGroups, token) ? rules.buttonGroups[token] : undefined;
    for (const b of group ?? [token]) if (!buttons.includes(b)) buttons.push(b);
  }
  return { dirs, buttons, chord: tokens.length > 1 };
}

/**
 * いまのフレーム（history の最後）で、派生の入力が成立したか。
 * 方向があればいまの方向がそのどれか。ボタンは、同時押し（chord）なら全部が押されていて、どれかが新しく押された。
 * そうでなければ、新しく押されたボタンのどれか
 */
export function followInputMatches(history: readonly FrameInput[], follow: FollowInput): boolean {
  const cur = history[history.length - 1];
  if (cur === undefined) return false;
  if (follow.dirs !== null && !follow.dirs.includes(cur.dir)) return false;
  const prev = history[history.length - 2];
  const fresh = (b: string): boolean => cur.buttons.includes(b) && !(prev?.buttons.includes(b) ?? false);
  return follow.chord
    ? follow.buttons.every((b) => cur.buttons.includes(b)) && follow.buttons.some(fresh)
    : follow.buttons.some(fresh);
}

/** 表記（例: 2LP, 236HP, [4]6P, 2D, 236HS, 236K~P, 5HP>HK）を入力の条件に読み替える */
export function parseStep(
  text: string,
  rules: NotationRules,
): { ok: true; input: StepInput } | { ok: false; error: string } {
  const t = text.trim();
  const fail = { ok: false, error: msg().unreadableNotation(t) } as const;

  // 派生: 親と派生を ~ か > でつなぐ
  if (/[~>]/.test(t)) {
    const parts = t.split(/[~>]/);
    if (parts.length !== 2) return fail;
    const [parentText, followText] = parts as [string, string];
    const parent = parseStep(parentText, rules);
    const follow = parseFollowInput(followText, rules);
    if (!parent.ok || parent.input.kind === 'followUp' || follow === null) return fail;
    return { ok: true, input: { kind: 'followUp', parent: parent.input, follow, text: t, buttons: follow.buttons } };
  }

  // 末尾のボタンの部分は、いちばん長く一致する名前にする（'HS' を 'S' と読み違えない）
  const name = [...rules.buttons, ...Object.keys(rules.buttonGroups)]
    .filter((n) => t.endsWith(n))
    .sort((a, b) => b.length - a.length)[0];
  if (name === undefined) return fail;
  const dirPart = t.slice(0, t.length - name.length);
  const group = Object.hasOwn(rules.buttonGroups, name) ? rules.buttonGroups[name] : undefined;

  if (/^[1-9]$/.test(dirPart)) {
    const d = Number(dirPart) as Direction;
    const dirs: readonly Direction[] = d === 2 ? [1, 2, 3] : [d];
    return { ok: true, input: { kind: 'normal', dirs, buttons: group ?? [name] } };
  }

  const command = rules.commands.find((c) => c.notation === dirPart);
  if (dirPart === '' || !command) return fail;
  const buttons = (group ?? [name]).filter((b) => command.buttons.includes(b));
  if (buttons.length === 0) return fail;
  return { ok: true, input: { kind: 'command', command, buttons } };
}

/**
 * 技の入力 own（text はその表記、input は読んだもの）が、wide（手や一覧の入力）に当たるか。
 * 通常技は、技の先頭の数字（5 か 2）が wide の方向に入っていて、ボタンが wide のボタンに入っているもの。
 * コマンドは、方向の表記が同じで、ボタンが wide のボタンに入っているもの（スト6 の P は LP・MP・HP のどれでもよい）。
 * 派生は、親が当たり、派生の方向・同時押しが同じで、派生のボタンが wide のボタンに入っているもの
 */
export function stepInputMatches(text: string, own: StepInput, wide: StepInput): boolean {
  if (own.kind === 'followUp' || wide.kind === 'followUp') {
    if (own.kind !== 'followUp' || wide.kind !== 'followUp') return false;
    const a = own.follow;
    const b = wide.follow;
    const sameDirs = a.dirs === null || b.dirs === null ? a.dirs === b.dirs : a.dirs.length === b.dirs.length && a.dirs.every((d) => b.dirs?.includes(d));
    const parentText = text.split(/[~>]/)[0] ?? '';
    return (
      sameDirs && a.chord === b.chord && a.buttons.every((x) => b.buttons.includes(x)) && stepInputMatches(parentText, own.parent, wide.parent)
    );
  }
  if (wide.kind === 'normal') {
    if (own.kind !== 'normal') return false;
    const dir = Number(text.charAt(0));
    return wide.dirs.some((d) => d === dir) && own.buttons.every((b) => wide.buttons.includes(b));
  }
  return own.kind === 'command' && own.command.notation === wide.command.notation && own.buttons.every((b) => wide.buttons.includes(b));
}
