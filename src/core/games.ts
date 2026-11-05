import { msg } from '../i18n/messages';

export type GameId = 'sf6' | 'ggst' | 'mbtl';

export interface GameInfo {
  id: GameId;
  /** 画面に出す名前（読んだときの言語で返る） */
  readonly name: string;
  /** false なら一覧には出すが選べない */
  available: boolean;
}

export const GAMES: readonly GameInfo[] = [
  { id: 'sf6', name: 'Street Fighter 6', available: true },
  { id: 'ggst', name: 'GUILTY GEAR -STRIVE-', available: true },
  {
    id: 'mbtl',
    get name() {
      return msg().gameMeltyBlood;
    },
    available: false,
  },
];

/** id から探す。ないか、文字列でなければ undefined */
export function findGame(id: unknown): GameInfo | undefined {
  return GAMES.find((g) => g.id === id);
}
