import './ui/style.css';
import { DEFAULT_COMMANDS } from './core/commands';
import { analyzeAttempt } from './core/detect';
import { compressHistory } from './core/history';
import { createFrameClock, dueFrames, type FrameClock } from './core/clock';
import type { FrameInput } from './core/types';
import { BUTTON_NAMES, loadBindings } from './input/bindings';
import { resolveDirection } from './input/direction';
import { readGamepads, type PadState } from './input/gamepad';
import { KeyboardReader } from './input/keyboard';
import { SAMPLE_RECIPES } from './core/samples';
import { createCommandPanel } from './ui/commandPanel';
import { createComboPanel } from './ui/comboPanel';
import { createHistoryView } from './ui/historyView';
import { createKeyConfig } from './ui/keyconfig';
import { createMetricsPanel } from './ui/metricsPanel';

const MAX_FRAMES = 600;
const HISTORY_ROWS = 20;
/** 一度に進めるフレーム数の上限（0.5 秒）。超えたら処理が止まっていたとみなす */
const MAX_CATCHUP = 30;
const STALL_MESSAGE = '処理が止まったため、この挑戦は無効です';

const app = document.getElementById('app');
if (!app) throw new Error('#app が見つかりません');

const bindings = loadBindings();
const keyboard = new KeyboardReader(window);
const metrics = createMetricsPanel(document.body);

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
let pad: PadState = readGamepads(bindings);
let lastPadTimestamp: number | null = null;

/** パッドを新しく読む。ブラウザでは rAF のときにしか読めない */
function refreshPad(): void {
  pad = readGamepads(bindings);
  for (const i of pad.rawPressed) if (!prevPadRaw.has(i)) keyConfig.onPadButton(i);
  prevPadRaw = new Set(pad.rawPressed);
  metrics.setPadPresent(pad.timestamp !== null);
  if (pad.timestamp !== null) {
    if (lastPadTimestamp !== null && pad.timestamp !== lastPadTimestamp) {
      metrics.onPadInterval(pad.timestamp - lastPadTimestamp);
    }
    lastPadTimestamp = pad.timestamp;
  } else {
    lastPadTimestamp = null;
  }
}

function stepFrame(end: number): void {
  // キーボードとパッドは OR で合成
  const { actions: key, downTimes } = keyboard.sample(end, bindings);
  const processedAt = performance.now();
  for (const t of downTimes) metrics.onKeyLatency(processedAt - t);
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

let clock: FrameClock | null = null;
function loop(): void {
  const now = performance.now();
  if (clock === null) clock = createFrameClock(now);
  const due = dueFrames(clock, now, MAX_CATCHUP);
  clock = due.clock;
  due.frameEnds.forEach((end, i) => {
    // パッドは最後のフレームでだけ新しく読み、それより前は前回の状態を使う
    if (i === due.frameEnds.length - 1) refreshPad();
    stepFrame(end);
  });
  if (due.stalled) {
    comboPanel.invalidate(STALL_MESSAGE);
    metrics.onStall();
  }
  metrics.onRaf(now, due.frameEnds.length);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
