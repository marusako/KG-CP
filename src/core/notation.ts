import type { CommandDef, Direction } from './types';

export type StepInput =
  | { kind: 'normal'; dirs: readonly Direction[]; buttons: readonly string[] }
  | { kind: 'command'; command: CommandDef; buttons: readonly string[] };

const PUNCH = ['LP', 'MP', 'HP'] as const;
const KICK = ['LK', 'MK', 'HK'] as const;
const BUTTON_SUFFIX = /(LP|MP|HP|LK|MK|HK|P|K)$/;

/** 表記（例: 2LP, 236HP, [4]6P）を入力の条件に読み替える */
export function parseStep(
  text: string,
  commands: readonly CommandDef[],
): { ok: true; input: StepInput } | { ok: false; error: string } {
  const t = text.trim();
  const fail = { ok: false, error: `「${t}」は読めない表記です` } as const;
  const m = BUTTON_SUFFIX.exec(t);
  if (!m) return fail;
  const button = m[1] as string;
  const dirPart = t.slice(0, m.index);
  const family = button.endsWith('P') ? 'P' : 'K';

  if (/^[1-9]$/.test(dirPart)) {
    const d = Number(dirPart) as Direction;
    const dirs: readonly Direction[] = d === 2 ? [1, 2, 3] : [d];
    const buttons = button === 'P' ? PUNCH : button === 'K' ? KICK : [button];
    return { ok: true, input: { kind: 'normal', dirs, buttons } };
  }

  const command = commands.find((c) => c.id === `${dirPart}${family}`);
  if (dirPart === '' || !command) return fail;
  const buttons = button === 'P' || button === 'K' ? command.buttons : [button];
  return { ok: true, input: { kind: 'command', command, buttons } };
}
