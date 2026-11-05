import { msg } from '../i18n/messages';
import type { CommandDef, Direction } from './types';

export type StepInput =
  | { kind: 'normal'; dirs: readonly Direction[]; buttons: readonly string[] }
  | { kind: 'command'; command: CommandDef; buttons: readonly string[] };

/** ゲームごとの表記のルール */
export interface NotationRules {
  /** ボタンの名前 */
  buttons: readonly string[];
  /** まとめ書き。例: スト6 の 'P' は ['LP','MP','HP']。GG にはない */
  buttonGroups: Readonly<Record<string, readonly string[]>>;
  commands: readonly CommandDef[];
}

/** 表記（例: 2LP, 236HP, [4]6P, 2D, 236HS）を入力の条件に読み替える */
export function parseStep(
  text: string,
  rules: NotationRules,
): { ok: true; input: StepInput } | { ok: false; error: string } {
  const t = text.trim();
  const fail = { ok: false, error: msg().unreadableNotation(t) } as const;
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
