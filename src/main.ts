import './ui/style.css';
import { DEFAULT_COMMANDS } from './core/commands';
import { analyzeAttempt } from './core/detect';
import { compressHistory } from './core/history';
import type { FrameInput } from './core/types';
import { BUTTON_NAMES, loadBindings } from './input/bindings';
import { resolveDirection } from './input/direction';
import { readGamepads } from './input/gamepad';
import { KeyboardReader } from './input/keyboard';
import { SAMPLE_RECIPES } from './core/samples';
import { createCommandPanel } from './ui/commandPanel';
import { createComboPanel } from './ui/comboPanel';
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

const tabBar = document.createElement('nav');
tabBar.className = 'tabs';
app.append(tabBar);
const renderHistory = createHistoryView(app);
const practicePane = document.createElement('div');
practicePane.className = 'tab-pane';
const comboPane = document.createElement('div');
comboPane.className = 'tab-pane';
app.append(practicePane, comboPane);
const panel = createCommandPanel(practicePane, DEFAULT_COMMANDS);
const comboPanel = createComboPanel(comboPane, DEFAULT_COMMANDS, SAMPLE_RECIPES);
const keyConfig = createKeyConfig(app, bindings, keyboard);

type Tab = 'practice' | 'combo';
let activeTab: Tab = 'practice';
const tabDefs: readonly (readonly [Tab, string, HTMLElement])[] = [
  ['practice', 'コマンド練習', practicePane],
  ['combo', 'コンボトライアル', comboPane],
];
const tabButtons = tabDefs.map(([tab, label]) => {
  const b = document.createElement('button');
  b.textContent = label;
  b.addEventListener('click', () => {
    activeTab = tab;
    comboPanel.reset();
    showTab();
    b.blur();
  });
  return b;
});
function showTab(): void {
  tabDefs.forEach(([tab, , pane], i) => {
    pane.hidden = tab !== activeTab;
    tabButtons[i]?.classList.toggle('active', tab === activeTab);
  });
}
tabBar.append(...tabButtons);
showTab();

const history: FrameInput[] = [];
/** 通算フレーム番号（毎フレーム 1 ずつ増える） */
let frame = 0;
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

  if (activeTab === 'combo') {
    comboPanel.step(history, frame);
  } else {
    const result = analyzeAttempt(history, panel.selected());
    if (result) panel.showResult(result);
  }
  frame++;
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
