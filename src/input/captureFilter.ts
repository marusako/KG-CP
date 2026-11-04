import type { DIRECTION_NAMES } from './bindings';

/** 方向の名前は bindings.ts の DIRECTION_NAMES 1 か所で決める */
export type PadDir = (typeof DIRECTION_NAMES)[number];

export interface RawInput {
  /** このフレームで押されていたキーのコード */
  keys: ReadonlySet<string>;
  /** このフレームで「押されていない状態から」押されたキーのコード */
  freshKeys: ReadonlySet<string>;
  /** 押しているパッドのボタン番号 */
  padButtons: ReadonlySet<number>;
  /** パッドで入っている方向（十字キー・スティック） */
  padDirs: ReadonlySet<PadDir>;
}

/** 離すまでゲームの入力に使わないもの */
export interface IgnoreSet {
  keys: ReadonlySet<string>;
  padButtons: ReadonlySet<number>;
  padDirs: ReadonlySet<PadDir>;
}

export function emptyIgnore(): IgnoreSet {
  return { keys: new Set(), padButtons: new Set(), padDirs: new Set() };
}

const union = <T>(a: ReadonlySet<T>, b: ReadonlySet<T>): Set<T> => new Set([...a, ...b]);
const keepHeld = <T>(ignore: ReadonlySet<T>, held: ReadonlySet<T>, except?: ReadonlySet<T>): Set<T> =>
  new Set([...ignore].filter((v) => held.has(v) && !except?.has(v)));
const minus = <T>(a: ReadonlySet<T>, b: ReadonlySet<T>): Set<T> => new Set([...a].filter((v) => !b.has(v)));

/**
 * 設定中・設定直後に押していた入力を、離すまでゲームに使わないようにする。
 * capturing は「捕まえ中、またはこのフレームで捕まえが終わった」。
 * 返す input はゲームに使ってよい入力
 */
export function filterInput(
  raw: RawInput,
  ignore: IgnoreSet,
  capturing: boolean,
): { input: Omit<RawInput, 'freshKeys'>; ignore: IgnoreSet } {
  if (capturing) {
    return {
      input: { keys: new Set(), padButtons: new Set(), padDirs: new Set() },
      ignore: {
        keys: union(ignore.keys, raw.keys),
        padButtons: union(ignore.padButtons, raw.padButtons),
        padDirs: union(ignore.padDirs, raw.padDirs),
      },
    };
  }
  const next: IgnoreSet = {
    // 1 フレームのうちに離して押し直したキーは、新しい押下として使えるようにする
    keys: keepHeld(ignore.keys, raw.keys, raw.freshKeys),
    padButtons: keepHeld(ignore.padButtons, raw.padButtons),
    padDirs: keepHeld(ignore.padDirs, raw.padDirs),
  };
  return {
    input: {
      keys: minus(raw.keys, next.keys),
      padButtons: minus(raw.padButtons, next.padButtons),
      padDirs: minus(raw.padDirs, next.padDirs),
    },
    ignore: next,
  };
}

export interface GateState {
  /** 前に見たとき、キーコンフィグが捕まえ中だった */
  capturePending: boolean;
  /** game に入った時刻。frameEnd がこれより後のフレームを 1 つ処理し終えるまで捨てる。null なら不要 */
  taintSince: number | null;
}

export const INITIAL_GATE: GateState = { capturePending: false, taintSince: null };

/**
 * game に入ったとき。決定に使った入力を押したまま入っても練習に漏れないよう、
 * 入った時刻より後に終わるフレームを 1 つ処理するまでは捕まえ中として扱う
 */
export function gateEnterGame(state: GateState, now: number): GateState {
  return { ...state, taintSince: now };
}

/** パッドを読んだ時点で捕まえ中だったとき（そのあと同じ読み取りで捕まえが終わっても、終わったフレームを捨てるため） */
export function gateSawCapturing(state: GateState): GateState {
  return { ...state, capturePending: true };
}

/**
 * 1 フレームごとに呼ぶ。block が true なら、このフレームの入力は filterInput の capturing を true にする。
 * 捕まえが終わったのを見つけたフレームだけ block する。キーで終えた場合、そのキーは captureNext が受け取るので
 * timeline に入らず、パッドで終えた場合もそのボタンはこのフレームに出る。だから 1 フレームで足りる
 */
export function gateFrame(
  state: GateState,
  frame: { capturing: boolean; onGameScreen: boolean; frameEnd: number },
): { block: boolean; state: GateState } {
  const { capturing, onGameScreen, frameEnd } = frame;
  const justEnded = !capturing && state.capturePending;
  const block = capturing || justEnded || state.taintSince !== null || !onGameScreen;
  const taintSince =
    !capturing && state.taintSince !== null && frameEnd > state.taintSince ? null : state.taintSince;
  return { block, state: { capturePending: capturing, taintSince } };
}
