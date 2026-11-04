import './ui/style.css';
import { DEFAULT_COMMANDS } from './core/commands';
import { analyzeAttempt } from './core/detect';
import { compressHistory } from './core/history';
import type { FrameInput } from './core/types';
import { BUTTON_NAMES, loadBindings } from './input/bindings';
import { resolveDirection } from './input/direction';
import { readGamepads } from './input/gamepad';
import { KeyboardReader } from './input/keyboard';
import { createCommandPanel } from './ui/commandPanel';
import { createHistoryView } from './ui/historyView';
import { createKeyConfig } from './ui/keyconfig';

const FRAME_MS = 1000 / 60;
const MAX_FRAMES = 600;
const HISTORY_ROWS = 20;
/** タブが裏に回ったあとなどで一度に進めるフレーム数の上限 */
const MAX_CATCHUP = 5;

const app = document.getElementById('app');
if (!app) throw new Error('#app が見つかりません');

const bindings = loadBindings();
const keyboard = new KeyboardReader(window);
const renderHistory = createHistoryView(app);
const panel = createCommandPanel(app, DEFAULT_COMMANDS);
const keyConfig = createKeyConfig(app, bindings, keyboard);

const history: FrameInput[] = [];
let prevPadRaw = new Set<number>();

function stepFrame(): void {
  const pad = readGamepads(bindings);
  for (const i of pad.rawPressed) if (!prevPadRaw.has(i)) keyConfig.onPadButton(i);
  prevPadRaw = new Set(pad.rawPressed);

  // キーボードとパッドは OR で合成
  const key = keyboard.read(bindings);
  const dir = resolveDirection(
    {
      up: key.up || pad.dirs.up,
      down: key.down || pad.dirs.down,
      left: key.left || pad.dirs.left,
      right: key.right || pad.dirs.right,
    },
    'neutral',
  );
  const buttons = BUTTON_NAMES.filter((b) => key[b] || pad.buttons[b]);
  history.push({ dir, buttons });
  if (history.length > MAX_FRAMES) history.shift();

  const result = analyzeAttempt(history, panel.selected());
  if (result) panel.showResult(result);
  renderHistory(compressHistory(history, HISTORY_ROWS));
}

let last = performance.now();
let acc = 0;
function loop(now: number): void {
  acc += now - last;
  last = now;
  let steps = 0;
  while (acc >= FRAME_MS && steps < MAX_CATCHUP) {
    stepFrame();
    acc -= FRAME_MS;
    steps++;
  }
  if (steps === MAX_CATCHUP) acc = 0;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
