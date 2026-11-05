import { LANGS, type Lang } from '../i18n/lang';
import { findCharacter } from './characters';
import { findGame, type GameId } from './games';
import { PLAYABLE_GAME_IDS, type PlayableGameId } from './profiles';

export interface Settings {
  /** 0〜100 の整数 */
  volume: number;
  /** 最後に選んだゲーム。ゲーム選択の最初のカーソル位置に使う */
  lastGame: GameId | null;
  /** ゲームごとに最後に選んだキャラの id。キャラなしは、その項目がない */
  lastCharacter: Partial<Record<PlayableGameId, string>>;
  /** 画面の言語 */
  lang: Lang;
}

export const DEFAULT_SETTINGS: Settings = { volume: 80, lastGame: null, lastCharacter: {}, lang: 'ja' };

/** 保存した lastCharacter を読む。そのゲームにいないキャラ・文字列でないものは捨てる */
function parseLastCharacter(v: unknown): Settings['lastCharacter'] {
  const out: Settings['lastCharacter'] = {};
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return out;
  const obj = v as Record<string, unknown>;
  for (const game of PLAYABLE_GAME_IDS) {
    const c = findCharacter(game, obj[game]);
    if (c) out[game] = c.id;
  }
  return out;
}

/** 保存した文字列（なければ null）から読む。壊れていても例外を投げず、おかしい項目だけ既定値にする */
export function parseSettings(raw: string | null, fallbackLang: Lang = 'ja'): Settings {
  const fallback: Settings = { ...DEFAULT_SETTINGS, lastCharacter: {}, lang: fallbackLang };
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
  const lang = LANGS.find((l) => l === obj.lang) ?? fallbackLang;
  return {
    volume,
    lastGame: game?.available ? game.id : null,
    lastCharacter: parseLastCharacter(obj.lastCharacter),
    lang,
  };
}

export function serializeSettings(s: Settings): string {
  return JSON.stringify({ volume: s.volume, lastGame: s.lastGame, lastCharacter: s.lastCharacter, lang: s.lang });
}
