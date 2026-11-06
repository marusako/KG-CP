import { msg } from '../i18n/messages';
import { analyzeAttempt, justPressedAny } from './detect';
import { followInputMatches, parseStep } from './notation';
import type { NotationRules, StepInput } from './notation';
import type { FrameInput } from './types';

export type { StepInput } from './notation';

/**
 * いまのフレーム（history の最後）で step の入力が成立したか。
 * 派生は、派生のボタンが押された瞬間に成立（親の入力は見ない。親の技が出ているかは、キャラの動きで見る新しい判定のほうで決める）
 */
export function matchesStep(history: readonly FrameInput[], input: StepInput): boolean {
  if (input.kind === 'followUp') return followInputMatches(history, input.follow);
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

export function parseRecipe(json: unknown, rules: NotationRules): ParseResult {
  const fail = (error: string): ParseResult => ({ ok: false, error });
  if (!isRecord(json)) return fail(msg().recipeNotObject);
  if (!isNonEmptyString(json.id)) return fail(msg().recipeIdInvalid);
  if (!isNonEmptyString(json.name)) return fail(msg().recipeNameInvalid);
  if (!Array.isArray(json.steps) || json.steps.length === 0) {
    return fail(msg().recipeStepsInvalid);
  }

  const steps: ComboStep[] = [];
  for (let i = 0; i < json.steps.length; i++) {
    const n = i + 1;
    const raw: unknown = json.steps[i];
    if (!isRecord(raw)) return fail(msg().stepNotObject(n));
    if (typeof raw.input !== 'string') return fail(msg().stepInputNotString(n));
    const parsed = parseStep(raw.input, rules);
    if (!parsed.ok) return fail(msg().stepError(n, parsed.error));
    const text = raw.input.trim();

    if (i === 0) {
      steps.push({ text, input: parsed.input, window: null });
      continue;
    }
    const w = raw.window;
    if (!Array.isArray(w) || w.length !== 2) {
      return fail(msg().windowShape(n));
    }
    const [min, max] = w as unknown[];
    if (!isFrameCount(min) || !isFrameCount(max)) {
      return fail(msg().windowInts(n));
    }
    if (min > max) return fail(msg().windowOrder(n));
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

/**
 * 1フレーム進める。frame はいまの通算フレーム番号。history の最後がいまのフレーム。
 * inputBuffer は先行入力。窓が開く inputBuffer フレーム前までの早押しは成功にし、
 * 次の手の基準は技が実際に出るフレームにする
 */
export function stepTrial(
  state: TrialState,
  recipe: ComboRecipe,
  history: readonly FrameInput[],
  frame: number,
  inputBuffer = 0,
): { state: TrialState; event: TrialEvent | null } {
  const step = recipe.steps[state.stepIndex];
  if (!step) return { state: initialTrialState(), event: null };
  const isLast = state.stepIndex === recipe.steps.length - 1;
  const matched = matchesStep(history, step.input);
  const advance = (offset: number | null, baseFrame = frame): { state: TrialState; event: TrialEvent } =>
    isLast
      ? { state: initialTrialState(), event: { type: 'complete', stepIndex: state.stepIndex, offset } }
      : {
          state: { stepIndex: state.stepIndex + 1, lastPressFrame: baseFrame },
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
  if (matched) {
    if (offset >= step.window.min) return advance(offset);
    if (offset < step.window.min - inputBuffer) return drop('early');
    return advance(offset, frame + (step.window.min - offset));
  }
  const cur = history[history.length - 1];
  if (cur !== undefined && justPressedAny(history, cur.buttons)) return drop('wrong');
  if (offset > step.window.max) return drop('late');
  return { state, event: null };
}
