import type { Direction } from '../core/types';

// 5（ニュートラル）は中黒で表す。中黒は記号なので、日本語の文字列が残っていないかのテストでは数えない
export const ARROWS: Record<Direction, string> = {
  1: '↙', 2: '↓', 3: '↘', 4: '←', 5: '・', 6: '→', 7: '↖', 8: '↑', 9: '↗',
};
