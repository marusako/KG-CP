import { analyzeAttempt, justPressedAny } from './detect';
import { parseStep } from './notation';
import type { StepInput } from './notation';
import type { CommandDef, FrameInput } from './types';

export type { StepInput } from './notation';

/** いまのフレーム（history の最後）で step の入力が成立したか */
export function matchesStep(history: readonly FrameInput[], input: StepInput): boolean {
  if (input.kind === 'command') {
    return analyzeAttempt(history, { ...input.command, buttons: input.buttons })?.ok === true;
  }
  const cur = history[history.length - 1];
  return cur !== undefined && justPressedAny(history, input.buttons) && input.dirs.includes(cur.dir);
}

export interface ComboStep {
  /** 元の表記 例: '2LP' */
  text: string;
  input: StepInput;
  /** 最初の手は null */
  window: { min: number; max: number } | null;
}
export interface ComboRecipe {
  id: string;
  name: string;
  steps: readonly ComboStep[];
}

type ParseResult = { ok: true; recipe: ComboRecipe } | { ok: false; error: string };

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v !== '';
const isFrameCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

export function parseRecipe(json: unknown, commands: readonly CommandDef[]): ParseResult {
  const fail = (error: string): ParseResult => ({ ok: false, error });
  if (!isRecord(json)) return fail('レシピはオブジェクトで書いてください');
  if (!isNonEmptyString(json.id)) return fail('id は空でない文字列にしてください');
  if (!isNonEmptyString(json.name)) return fail('name は空でない文字列にしてください');
  if (!Array.isArray(json.steps) || json.steps.length === 0) {
    return fail('steps は 1 個以上の配列にしてください');
  }

  const steps: ComboStep[] = [];
  for (let i = 0; i < json.steps.length; i++) {
    const n = i + 1;
    const raw: unknown = json.steps[i];
    if (!isRecord(raw)) return fail(`${n}手目: オブジェクトで書いてください`);
    if (typeof raw.input !== 'string') return fail(`${n}手目: input は文字列で書いてください`);
    const parsed = parseStep(raw.input, commands);
    if (!parsed.ok) return fail(`${n}手目: ${parsed.error}`);
    const text = raw.input.trim();

    if (i === 0) {
      steps.push({ text, input: parsed.input, window: null });
      continue;
    }
    const w = raw.window;
    if (!Array.isArray(w) || w.length !== 2) {
      return fail(`${n}手目: window は [min, max] の形で書いてください`);
    }
    const [min, max] = w as unknown[];
    if (!isFrameCount(min) || !isFrameCount(max)) {
      return fail(`${n}手目: window は 0 以上の整数で書いてください`);
    }
    if (min > max) return fail(`${n}手目: window は min が max 以下になるように書いてください`);
    steps.push({ text, input: parsed.input, window: { min, max } });
  }
  return { ok: true, recipe: { id: json.id, name: json.name, steps } };
}

export interface TrialState {
  /** 次に入力すべき手 */
  stepIndex: number;
  /** 直前の手が成立した通算フレーム番号 */
  lastPressFrame: number | null;
}
export type TrialEvent =
  | { type: 'hit'; stepIndex: number; offset: number | null }
  | { type: 'complete'; stepIndex: number; offset: number | null }
  | { type: 'drop'; stepIndex: number; reason: 'early' | 'late' | 'wrong'; offset: number };

export function initialTrialState(): TrialState {
  return { stepIndex: 0, lastPressFrame: null };
}

/** 最初の手が成立し、まだ完走も失敗もしていないとき true */
export function isAttemptInProgress(state: TrialState): boolean {
  return state.stepIndex > 0;
}

/** 1フレーム進める。frame はいまの通算フレーム番号。history の最後がいまのフレーム。 */
export function stepTrial(
  state: TrialState,
  recipe: ComboRecipe,
  history: readonly FrameInput[],
  frame: number,
): { state: TrialState; event: TrialEvent | null } {
  const step = recipe.steps[state.stepIndex];
  if (!step) return { state: initialTrialState(), event: null };
  const isLast = state.stepIndex === recipe.steps.length - 1;
  const matched = matchesStep(history, step.input);
  const advance = (offset: number | null): { state: TrialState; event: TrialEvent } =>
    isLast
      ? { state: initialTrialState(), event: { type: 'complete', stepIndex: state.stepIndex, offset } }
      : {
          state: { stepIndex: state.stepIndex + 1, lastPressFrame: frame },
          event: { type: 'hit', stepIndex: state.stepIndex, offset },
        };

  if (state.stepIndex === 0 || state.lastPressFrame === null || step.window === null) {
    return matched ? advance(null) : { state, event: null };
  }

  const offset = frame - state.lastPressFrame;
  const drop = (reason: 'early' | 'late' | 'wrong') => ({
    state: initialTrialState(),
    event: { type: 'drop', stepIndex: state.stepIndex, reason, offset } as const,
  });
  if (matched) return offset < step.window.min ? drop('early') : advance(offset);
  const cur = history[history.length - 1];
  if (cur !== undefined && justPressedAny(history, cur.buttons)) return drop('wrong');
  if (offset > step.window.max) return drop('late');
  return { state, event: null };
}
