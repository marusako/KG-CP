import type { Direction, FrameInput } from './types';

export interface HistoryEntry {
  dir: Direction;
  /** 押されているボタン（順番はそのフレームの buttons のまま） */
  buttons: readonly string[];
  /** この区間の先頭フレームで「押された瞬間」だったボタン */
  pressed: readonly string[];
  /** 同じ状態が続いたフレーム数 */
  frames: number;
}

function stateKey(f: FrameInput): string {
  return `${f.dir}:${[...f.buttons].sort().join(',')}`;
}

/** 同じ状態（方向＋ボタンの集合）が続く区間をまとめ、新しい順に maxEntries 件返す */
export function compressHistory(history: readonly FrameInput[], maxEntries: number): HistoryEntry[] {
  const entries: HistoryEntry[] = [];
  let lastKey = '';
  for (let i = 0; i < history.length; i++) {
    const cur = history[i] as FrameInput;
    const key = stateKey(cur);
    const last = entries[entries.length - 1];
    if (last && key === lastKey) {
      last.frames++;
      continue;
    }
    const prev = history[i - 1];
    entries.push({
      dir: cur.dir,
      buttons: cur.buttons,
      pressed: cur.buttons.filter((b) => !(prev?.buttons.includes(b) ?? false)),
      frames: 1,
    });
    lastKey = key;
  }
  return entries.reverse().slice(0, Math.max(0, maxEntries));
}
