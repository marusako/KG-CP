import type { PlayableGameId } from './profiles';

/** save は書き込む場所、read は読む場所（前から順に見て、最初にあったものを使う） */
export interface StorageKeys {
  save: string;
  read: readonly string[];
}

/** ゲームごとのキーを作る。スト6 だけは、ゲームが 1 つだった前の版のキーも読む（書き換えはしない） */
function keysFor(id: PlayableGameId, key: string, legacy: string): StorageKeys {
  return { save: key, read: id === 'sf6' ? [key, legacy] : [key] };
}

/** キーの割り当ての保存場所 */
export function bindingsKeys(id: PlayableGameId): StorageKeys {
  return keysFor(id, `kg-cp:bindings:${id}`, 'kg-cp:bindings');
}

/** 読み込んだコンボのレシピの保存場所 */
export function recipesKeys(id: PlayableGameId): StorageKeys {
  return keysFor(id, `kgcp.comboRecipes.${id}`, 'kgcp.comboRecipes');
}

/** keys の順に get して、最初に null でなかったものを返す。どこにもなければ null */
export function readFirst(get: (key: string) => string | null, keys: readonly string[]): string | null {
  for (const key of keys) {
    const v = get(key);
    if (v !== null) return v;
  }
  return null;
}
