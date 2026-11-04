export type PadDir = 'up' | 'down' | 'left' | 'right';

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
