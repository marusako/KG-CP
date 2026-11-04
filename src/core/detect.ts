import type { AttemptResult, CommandDef, Direction, FrameInput, MotionStep } from './types';

type RotationGroup = 'left' | 'down' | 'right' | 'up';

const ROTATION_GROUPS: readonly (readonly [RotationGroup, readonly Direction[]])[] = [
  ['left', [1, 4, 7]],
  ['down', [1, 2, 3]],
  ['right', [3, 6, 9]],
  ['up', [7, 8, 9]],
];

/** いまのフレーム（最後の要素）で buttons のどれかが押された瞬間か */
export function justPressedAny(history: readonly FrameInput[], buttons: readonly string[]): boolean {
  const cur = history[history.length - 1];
  if (!cur) return false;
  const prev = history[history.length - 2];
  return buttons.some((b) => cur.buttons.includes(b) && !(prev?.buttons.includes(b) ?? false));
}

function justPressed(history: readonly FrameInput[], def: CommandDef): boolean {
  return justPressedAny(history, def.buttons);
}

/**
 * コマンドの成否を判定する。history は古い順で、最後の要素が「いまのフレーム」。
 * いまのフレームで def.buttons が押された瞬間でなければ null。
 */
export function analyzeAttempt(history: readonly FrameInput[], def: CommandDef): AttemptResult | null {
  if (!justPressed(history, def)) return null;
  const b = history.length - 1;
  return def.kind === 'rotation' ? analyzeRotation(history, def, b) : analyzeMotion(history, def, b);
}

function dirAt(history: readonly FrameInput[], i: number): Direction | undefined {
  return history[i]?.dir;
}

function analyzeMotion(
  history: readonly FrameInput[],
  def: Extract<CommandDef, { kind: 'motion' }>,
  b: number,
): AttemptResult {
  const found = findBackward(history, def.steps, b);
  if (!found) return incomplete(history, def, b);

  const { frames, lastFrame: last } = found;
  const first = frames.length === 1 ? last : (frames[0] as number);

  for (let i = 0; i < def.steps.length; i++) {
    const step = def.steps[i] as MotionStep;
    if (step.minHold === undefined) continue;
    const held = heldFrames(history, frames[i] as number, step);
    if (held < step.minHold) return { ok: false, reason: 'charge-short', heldFrames: held };
  }

  const motionFrames = last - first;
  if (motionFrames > def.motionWindow) return { ok: false, reason: 'too-slow', motionFrames };
  const buttonDelay = b - last;
  if (buttonDelay > def.buttonWindow) return { ok: false, reason: 'button-late', buttonDelay };
  return { ok: true, motionFrames, buttonDelay };
}

/**
 * 後ろから貪欲に各手のフレームを探す。全部見つからなければ null。
 * frames は各手の最も新しい一致フレーム。lastFrame は最後の手の「入った瞬間」
 * （最後の手の方向が続く区間の先頭）で、1つ前の手はそれより前から探す。
 */
function findBackward(
  history: readonly FrameInput[],
  steps: readonly MotionStep[],
  b: number,
): { frames: number[]; lastFrame: number } | null {
  const frames: number[] = [];
  let lastFrame = b;
  let limit = b;
  for (let s = steps.length - 1; s >= 0; s--) {
    const step = steps[s] as MotionStep;
    let found = -1;
    for (let i = limit; i >= 0; i--) {
      const d = dirAt(history, i);
      if (d !== undefined && step.dirs.includes(d)) {
        found = i;
        break;
      }
    }
    if (found < 0) return null;
    frames.unshift(found);
    let entry = found;
    if (s === steps.length - 1) {
      while (entry > 0) {
        const d = dirAt(history, entry - 1);
        if (d === undefined || !step.dirs.includes(d)) break;
        entry--;
      }
      lastFrame = entry;
    }
    limit = entry - 1;
  }
  return { frames, lastFrame };
}

/** フレーム f から前に向かって、方向が step.dirs に入り続けるフレーム数（f を含む） */
function heldFrames(history: readonly FrameInput[], f: number, step: MotionStep): number {
  let n = 0;
  for (let i = f; i >= 0; i--) {
    const d = dirAt(history, i);
    if (d === undefined || !step.dirs.includes(d)) break;
    n++;
  }
  return n;
}

/** 前向き探索で、どの手まで揃ったかを調べる */
function incomplete(
  history: readonly FrameInput[],
  def: Extract<CommandDef, { kind: 'motion' }>,
  b: number,
): AttemptResult {
  const start = Math.max(0, b - (def.motionWindow + def.buttonWindow));
  let from = start;
  let matched = 0;
  for (const step of def.steps) {
    let found = -1;
    for (let i = from; i <= b; i++) {
      const d = dirAt(history, i);
      if (d !== undefined && step.dirs.includes(d)) {
        found = i;
        break;
      }
    }
    if (found < 0) break;
    matched++;
    // この手の方向が続く区間を飛ばす（66 のように隣り合う手の dirs が重なる定義のため）
    from = found + heldFramesForward(history, found, b, step);
  }
  // 隣り合う手の dirs が重なる定義では、後ろ向き探索が失敗しても前向きで全手が揃うことがある。
  // そのときは最後の手が足りない扱いにする
  const next = def.steps[matched];
  if (!next) {
    const last = def.steps[def.steps.length - 1];
    return { ok: false, reason: 'incomplete', matchedSteps: def.steps.length - 1, expected: last?.dirs ?? [] };
  }
  return { ok: false, reason: 'incomplete', matchedSteps: matched, expected: next.dirs };
}

/** フレーム f から b まで、方向が step.dirs に入り続けるフレーム数（f を含む） */
function heldFramesForward(history: readonly FrameInput[], f: number, b: number, step: MotionStep): number {
  let n = 0;
  for (let i = f; i <= b; i++) {
    const d = dirAt(history, i);
    if (d === undefined || !step.dirs.includes(d)) break;
    n++;
  }
  return n;
}

function analyzeRotation(
  history: readonly FrameInput[],
  def: Extract<CommandDef, { kind: 'rotation' }>,
  b: number,
): AttemptResult {
  const start = Math.max(0, b - def.motionWindow);
  const seen = new Set<RotationGroup>();
  let firstFrame = -1;
  for (let i = start; i <= b; i++) {
    const d = dirAt(history, i);
    if (d === undefined) continue;
    for (const [name, dirs] of ROTATION_GROUPS) {
      if (dirs.includes(d)) {
        seen.add(name);
        if (firstFrame < 0) firstFrame = i;
      }
    }
  }
  const missing = ROTATION_GROUPS.map(([name]) => name).filter((n) => !seen.has(n));
  if (missing.length > 0) return { ok: false, reason: 'rotation-incomplete', missing };
  return { ok: true, motionFrames: b - firstFrame, buttonDelay: 0 };
}
