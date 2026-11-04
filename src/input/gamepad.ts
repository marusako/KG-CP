import { stickToPressed, type PressedDirs } from './direction';

const DEADZONE = 0.5;

/** パッド 1 台ぶんの読み取り（キーコンフィグ用） */
export interface PadInfo {
  index: number;
  id: string;
  mapping: string;
  /** いま押されているボタン番号 */
  pressed: number[];
  /** 左スティックの値（-1〜1、y は下が正） */
  stick: { x: number; y: number };
  /** 左スティックが倒れている方向（デッドゾーンを超えたもの） */
  stickDirs: PressedDirs;
}

export interface PadState {
  dirs: PressedDirs;
  /** いま押されているボタン番号。操作への変換は main.ts が今の割り当てで行う */
  rawPressed: number[];
  /** 接続中のパッドの Gamepad.timestamp の最大値（パッドがなければ null。計測用） */
  timestamp: number | null;
  /** パッドごとの読み取り */
  pads: PadInfo[];
}

function connectedPads(): Gamepad[] {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) return [];
  // 抜いたパッドを null ではなく connected: false で返すブラウザもあるので、両方除く
  return Array.from(navigator.getGamepads()).filter((g): g is Gamepad => g !== null && g.connected);
}

/** 接続されている全パッドを OR で合成して読む。十字キー（12-15）と左スティック */
export function readGamepads(): PadState {
  const dirs: PressedDirs = { up: false, down: false, left: false, right: false };
  const raw = new Set<number>();
  const pads: PadInfo[] = [];
  let timestamp: number | null = null;
  for (const pad of connectedPads()) {
    timestamp = Math.max(timestamp ?? -Infinity, pad.timestamp);
    const sx = pad.axes[0] ?? 0;
    const sy = pad.axes[1] ?? 0;
    const stick = stickToPressed(sx, sy, DEADZONE);
    const pressed: number[] = [];
    dirs.up ||= stick.up || !!pad.buttons[12]?.pressed;
    dirs.down ||= stick.down || !!pad.buttons[13]?.pressed;
    dirs.left ||= stick.left || !!pad.buttons[14]?.pressed;
    dirs.right ||= stick.right || !!pad.buttons[15]?.pressed;
    pad.buttons.forEach((b, i) => {
      if (b.pressed) {
        raw.add(i);
        pressed.push(i);
      }
    });
    pads.push({ index: pad.index, id: pad.id, mapping: pad.mapping, pressed, stick: { x: sx, y: sy }, stickDirs: stick });
  }
  return { dirs, rawPressed: [...raw], timestamp, pads };
}
