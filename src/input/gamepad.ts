import { BUTTON_NAMES, type Bindings } from './bindings';
import { stickToPressed, type PressedDirs } from './direction';

const DEADZONE = 0.5;

export interface PadState {
  dirs: PressedDirs;
  buttons: Record<(typeof BUTTON_NAMES)[number], boolean>;
  /** いま押されているボタン番号（キーコンフィグ用） */
  rawPressed: number[];
  /** 接続中のパッドの Gamepad.timestamp の最大値（パッドがなければ null。計測用） */
  timestamp: number | null;
}

function connectedPads(): Gamepad[] {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) return [];
  return Array.from(navigator.getGamepads()).filter((g): g is Gamepad => g !== null);
}

/** 接続されている全パッドを OR で合成して読む。十字キー（12-15）と左スティック */
export function readGamepads(bindings: Bindings): PadState {
  const dirs: PressedDirs = { up: false, down: false, left: false, right: false };
  const buttons = { LP: false, MP: false, HP: false, LK: false, MK: false, HK: false };
  const raw = new Set<number>();
  let timestamp: number | null = null;
  for (const pad of connectedPads()) {
    timestamp = Math.max(timestamp ?? -Infinity, pad.timestamp);
    const stick = stickToPressed(pad.axes[0] ?? 0, pad.axes[1] ?? 0, DEADZONE);
    dirs.up ||= stick.up || !!pad.buttons[12]?.pressed;
    dirs.down ||= stick.down || !!pad.buttons[13]?.pressed;
    dirs.left ||= stick.left || !!pad.buttons[14]?.pressed;
    dirs.right ||= stick.right || !!pad.buttons[15]?.pressed;
    pad.buttons.forEach((b, i) => {
      if (b.pressed) raw.add(i);
    });
    for (const name of BUTTON_NAMES) {
      if (pad.buttons[bindings.pad[name]]?.pressed) buttons[name] = true;
    }
  }
  return { dirs, buttons, rawPressed: [...raw], timestamp };
}
