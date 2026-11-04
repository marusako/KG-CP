import type { Direction } from '../core/types';

export interface PressedDirs {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

export type SocdUpDown = 'up' | 'neutral';

/** 押されている上下左右からテンキー方向を決める。左右同時押しは常に左右ニュートラル。上下同時押しは socd に従う */
export function resolveDirection(p: PressedDirs, socd: SocdUpDown): Direction {
  const x = p.left === p.right ? 0 : p.right ? 1 : -1;
  let y = 0; // 上が正
  if (p.up && p.down) y = socd === 'up' ? 1 : 0;
  else if (p.up) y = 1;
  else if (p.down) y = -1;
  return (5 + x + y * 3) as Direction;
}

/** スティックの値（-1〜1、y は下が正）を上下左右に変換。|値| が deadzone 以下は押していない扱い */
export function stickToPressed(x: number, y: number, deadzone: number): PressedDirs {
  return {
    up: y < -deadzone,
    down: y > deadzone,
    left: x < -deadzone,
    right: x > deadzone,
  };
}
