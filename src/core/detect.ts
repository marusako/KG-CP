import type { AttemptResult, CommandDef, Direction, FrameInput, MotionStep } from './types';

type RotationGroup = 'left' | 'down' | 'right' | 'up';

const ROTATION_GROUPS: readonly (readonly [RotationGroup, readonly Direction[]])[] = [
  ['left', [1, 4, 7]],
  ['down', [1, 2, 3]],
  ['right', [3, 6, 9]],
  ['up', [7, 8, 9]],
];

/** いまのフレーム（最後の要素）で def.buttons のどれかが押された瞬間か */
function justPressed(history: readonly FrameInput[], def: CommandDef): boolean {
  const cur = history[history.length - 1];
  if (!cur) return false;
  const prev = history[history.length - 2];
  return def.buttons.some((b) => cur.buttons.includes(b) && !(prev?.buttons.includes(b) ?? false));
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
  const frames = findBackward(history, def.steps, b);
  if (!frames) return incomplete(history, def, b);

  const first = frames[0] as number;
  const last = frames[frames.length - 1] as number;

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

/** 後ろから貪欲に各手のフレームを探す。全部見つからなければ null */
function findBackward(
  history: readonly FrameInput[],
  steps: readonly MotionStep[],
  b: number,
): number[] | null {
  const frames: number[] = [];
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
    limit = found - 1;
  }
  return frames;
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
    from = found + 1;
  }
  const next = def.steps[matched] ?? def.steps[def.steps.length - 1];
  return { ok: false, reason: 'incomplete', matchedSteps: matched, expected: next?.dirs ?? [] };
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
