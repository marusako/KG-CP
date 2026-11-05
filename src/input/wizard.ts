import { msg } from '../i18n/messages';
import type { GameProfile } from '../core/profiles';
import { actionsFor, type Action, type Bindings } from './bindings';

export type WizardTarget = 'keyboard' | 'pad';
export interface WizardState {
  readonly target: WizardTarget;
  /** keyboard は actionsFor(profile)、pad は profile.buttons（方向は十字キーとスティックで固定） */
  readonly actions: readonly Action[];
  /** 次に聞く操作の番号 */
  readonly index: number;
  /** これまでに選ばれた入力（keyboard はコード、pad はボタン番号） */
  readonly picked: readonly (string | number)[];
  /** 直前の入力を受け付けなかった理由 */
  readonly error: string | null;
  readonly done: boolean;
}

/** 操作の表示名。方向は「上・下・左・右」、ボタンは名前そのまま */
export function actionName(action: Action): string {
  const labels: Readonly<Record<string, string>> = msg().dir;
  return labels[action] ?? action;
}

export function startWizard(target: WizardTarget, profile: GameProfile): WizardState {
  return {
    target,
    actions: target === 'keyboard' ? actionsFor(profile) : profile.buttons,
    index: 0,
    picked: [],
    error: null,
    done: false,
  };
}

export function wizardPress(state: WizardState, input: string | number): WizardState {
  if (state.done) return state;
  if (state.target === 'keyboard' ? typeof input !== 'string' : typeof input !== 'number') return state;
  const reject = (error: string): WizardState => ({ ...state, error });
  if (state.target === 'keyboard' && input === 'Escape') return reject(msg().wizardEscReserved);
  if (state.target === 'pad' && typeof input === 'number' && input >= 12 && input <= 15) {
    return reject(msg().wizardDpadReserved);
  }
  const usedAt = state.picked.indexOf(input);
  if (usedAt >= 0) return reject(msg().wizardAlreadyUsed(actionName(state.actions[usedAt]!)));
  const index = state.index + 1;
  return { ...state, picked: [...state.picked, input], index, error: null, done: index >= state.actions.length };
}

/** done のときだけ使う。picked を current に上書きした新しい Bindings を返す */
export function wizardResult(state: WizardState, current: Bindings): Bindings {
  const keys = { ...current.keys };
  const pad = { ...current.pad };
  state.actions.forEach((action, i) => {
    const v = state.picked[i];
    if (state.target === 'keyboard' && typeof v === 'string') keys[action] = v;
    if (state.target === 'pad' && typeof v === 'number') pad[action] = v;
  });
  return { keys, pad };
}
