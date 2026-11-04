import './ui/style.css';
import { DEFAULT_COMMANDS } from './core/commands';
import { analyzeAttempt } from './core/detect';
import { compressHistory } from './core/history';
import { createFrameClock, dueFrames, type FrameClock } from './core/clock';
import type { FrameInput } from './core/types';
import { dropDisconnected, nextActiveDevice, type Device } from './input/activeDevice';
import { emptyIgnore, filterInput, type IgnoreSet, type PadDir } from './input/captureFilter';
import { BUTTON_NAMES, DIRECTION_NAMES, loadBindings } from './input/bindings';
import { resolveDirection } from './input/direction';
import { readGamepads, type PadInfo, type PadState } from './input/gamepad';
import { KeyboardReader } from './input/keyboard';
import { detectPadFamily } from './input/padLayout';
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
/** パッドごとの前回の「押している入力」（ボタン番号と左スティックの方向）。新しく押された瞬間の判定用 */
const prevPadInputs = new Map<number, Set<string>>();
/** 捕まえ中（と終わった直後）に押していた入力。離すまでゲームの入力に使わない */
let ignore: IgnoreSet = emptyIgnore();
/** 捕まえが終わったフレームも、押していた入力がゲームに漏れないよう捕まえ中として扱う */
let tainting = false;
let activeDevice: Device = { kind: 'keyboard' };

function padInputs(p: PadInfo): Set<string> {
  const s = new Set(p.pressed.map((i) => `b${i}`));
  for (const d of DIRECTION_NAMES) if (p.stickDirs[d]) s.add(`s${d}`);
  return s;
}

/** このフレームで新しく押されたデバイス（キーボード、パッド）を返し、操作中のデバイスを更新する */
function updateActiveDevice(wasCapturing: boolean): void {
  const pressed: Device[] = [];
  // キーボードの印は捕まえ中でも取り出して下ろす（捕まえ中の押下は数えない）
  if (keyboard.takeAnyKeyDown() && !wasCapturing) pressed.push({ kind: 'keyboard' });
  const seen = new Set<number>();
  for (const p of pad.pads) {
    seen.add(p.index);
    const now = padInputs(p);
    // 初めて見えたパッドは、前回を「何も押していない」とみなす
    const before = prevPadInputs.get(p.index) ?? new Set<string>();
    prevPadInputs.set(p.index, now);
    if (!wasCapturing && [...now].some((k) => !before.has(k))) {
      pressed.push({ kind: 'pad', index: p.index, id: p.id, family: detectPadFamily(p.id, p.mapping) });
    }
  }
  for (const i of prevPadInputs.keys()) if (!seen.has(i)) prevPadInputs.delete(i);
  const next = nextActiveDevice(dropDisconnected(activeDevice, pad.pads.map((p) => p.index)), pressed);
  if (next !== activeDevice) {
    activeDevice = next;
    keyConfig.setDevice(next);
  }
  keyConfig.update(pad.pads);
}
let pad: PadState = readGamepads(bindings);
let lastPadTimestamp: number | null = null;

/** パッドを新しく読む。ブラウザでは rAF のときにしか読めない */
function refreshPad(): void {
  pad = readGamepads(bindings);
  // この読み取りで捕まえが終わっても、今回の押下はゲームにも操作中のデバイスにも使わない
  const wasCapturing = keyConfig.isCapturing();
  if (wasCapturing) tainting = true;
  for (const i of pad.rawPressed) if (!prevPadRaw.has(i)) keyConfig.onPadButton(i);
  prevPadRaw = new Set(pad.rawPressed);
  updateActiveDevice(wasCapturing);
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
  const { pressed, fresh, downTimes } = keyboard.sample(end);
  // キー入力から、そのイベントを取り出したフレームを処理するまでの遅れ（計測パネル用）
  const processedAt = performance.now();
  for (const t of downTimes) metrics.onKeyLatency(processedAt - t);
  // キーコンフィグで入力待ちの間と、その間に押していた入力を離すまでは、ゲームの入力に使わない
  const capturing = keyConfig.isCapturing();
  const filtered = filterInput(
    {
      keys: pressed,
      freshKeys: fresh,
      padButtons: new Set(pad.rawPressed),
      padDirs: new Set<PadDir>(DIRECTION_NAMES.filter((d) => pad.dirs[d])),
    },
    ignore,
    capturing || tainting,
  );
  ignore = filtered.ignore;
  if (!capturing) tainting = false;
  const { input } = filtered;
  const on = (d: PadDir): boolean => input.keys.has(bindings.keys[d]) || input.padDirs.has(d);
  const dir = resolveDirection({ up: on('up'), down: on('down'), left: on('left'), right: on('right') }, 'neutral');
  const buttons = BUTTON_NAMES.filter((b) => input.keys.has(bindings.keys[b]) || input.padButtons.has(bindings.pad[b]));
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
