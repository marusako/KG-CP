import { ACTIONS, BUTTON_NAMES, type Action, type Bindings } from './bindings';

export type WizardTarget = 'keyboard' | 'pad';
export interface WizardState {
  readonly target: WizardTarget;
  /** keyboard は ACTIONS、pad は BUTTON_NAMES（方向は十字キーとスティックで固定） */
  readonly actions: readonly Action[];
  /** 次に聞く操作の番号 */
  readonly index: number;
  /** これまでに選ばれた入力（keyboard はコード、pad はボタン番号） */
  readonly picked: readonly (string | number)[];
  /** 直前の入力を受け付けなかった理由 */
  readonly error: string | null;
  readonly done: boolean;
}

const ACTION_NAMES: Readonly<Record<Action, string>> = {
  up: '上', down: '下', left: '左', right: '右',
  LP: 'LP', MP: 'MP', HP: 'HP', LK: 'LK', MK: 'MK', HK: 'HK',
};

/** 操作の表示名 */
export function actionName(action: Action): string {
  return ACTION_NAMES[action];
}

export function startWizard(target: WizardTarget): WizardState {
  return {
    target,
    actions: target === 'keyboard' ? ACTIONS : BUTTON_NAMES,
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
  if (state.target === 'keyboard' && input === 'Escape') return reject('Esc は取り消しに使うので割り当てられません');
  if (state.target === 'pad' && typeof input === 'number' && input >= 12 && input <= 15) {
    return reject('十字キーは方向に使うので、ボタンには割り当てられません');
  }
  const usedAt = state.picked.indexOf(input);
  if (usedAt >= 0) return reject(`すでに ${actionName(state.actions[usedAt]!)} に使っています`);
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
    if (state.target === 'pad' && typeof v === 'number') pad[action as (typeof BUTTON_NAMES)[number]] = v;
  });
  return { keys, pad };
}
