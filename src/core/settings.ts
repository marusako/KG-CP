import { findGame, type GameId } from './games';

export interface Settings {
  /** 0〜100 の整数 */
  volume: number;
  /** 最後に選んだゲーム。ゲーム選択の最初のカーソル位置に使う */
  lastGame: GameId | null;
}

export const DEFAULT_SETTINGS: Settings = { volume: 80, lastGame: null };

/** 保存した文字列（なければ null）から読む。壊れていても例外を投げず、おかしい項目だけ既定値にする */
export function parseSettings(raw: string | null): Settings {
  const fallback: Settings = { ...DEFAULT_SETTINGS };
  if (raw === null) return fallback;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return fallback;
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return fallback;
  const obj = data as Record<string, unknown>;
  const v = obj.volume;
  const volume =
    typeof v === 'number' && Number.isFinite(v) ? Math.round(Math.min(100, Math.max(0, v))) : DEFAULT_SETTINGS.volume;
  const game = findGame(obj.lastGame);
  return { volume, lastGame: game?.available ? game.id : null };
}

export function serializeSettings(s: Settings): string {
  return JSON.stringify({ volume: s.volume, lastGame: s.lastGame });
}
