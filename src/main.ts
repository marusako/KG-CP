import './ui/style.css';
import { DEFAULT_COMMANDS } from './core/commands';
import { analyzeAttempt } from './core/detect';
import { compressHistory, historyAfterStall } from './core/history';
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
import type { GameId } from './core/games';
import { NO_MENU_BUTTONS, menuActions, type MenuAction, type MenuButtons } from './core/menu';
import { DEFAULT_SETTINGS, parseSettings, serializeSettings, type Settings } from './core/settings';
import { createCommandPanel } from './ui/commandPanel';
import { createComboPanel } from './ui/comboPanel';
import { createHistoryView } from './ui/historyView';
import { createKeyConfig } from './ui/keyconfig';
import { createMetricsPanel } from './ui/metricsPanel';
import { createGameBar, createScreens, type Screen } from './ui/screens';

const SETTINGS_KEY = 'kgcp.settings';
/** パッドのメニュー操作に使うボタン（下のボタンが決定、右のボタンが戻る） */
const PAD_CONFIRM = 0;
const PAD_BACK = 1;
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

function loadSettings(): Settings {
  try {
    return parseSettings(localStorage.getItem(SETTINGS_KEY));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, serializeSettings(s));
  } catch {
    // localStorage が使えなくても動作は続ける
  }
}

let settings = loadSettings();

/** 練習画面（game のときだけ見せる）。レイアウトに影響しないよう display: contents で包む */
const gameRoot = document.createElement('div');
gameRoot.className = 'game-root';
app.append(gameRoot);

const gameBar = createGameBar(gameRoot, () => {
  screens.show('title');
});
const tabBar = document.createElement('nav');
tabBar.className = 'tabs';
gameRoot.append(tabBar);
const renderHistory = createHistoryView(gameRoot);
const practicePane = document.createElement('div');
practicePane.className = 'tab-pane';
const comboPane = document.createElement('div');
comboPane.className = 'tab-pane';
gameRoot.append(practicePane, comboPane);
const panel = createCommandPanel(practicePane, DEFAULT_COMMANDS);
const comboPanel = createComboPanel(comboPane, DEFAULT_COMMANDS, SAMPLE_RECIPES);
const keyConfig = createKeyConfig(gameRoot, bindings, keyboard);

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

const screens = createScreens(app, {
  getSettings: () => settings,
  onVolume: (volume) => {
    settings = { ...settings, volume };
    saveSettings(settings);
  },
  onSelectGame: (id: GameId) => {
    settings = { ...settings, lastGame: id };
    saveSettings(settings);
    gameBar.setGame(id);
  },
  onScreen: (screen: Screen, prev: Screen) => {
    gameRoot.hidden = screen !== 'game';
    if (screen === 'game' || prev === 'game') {
      // 練習の途中の状態は捨てる
      comboPanel.reset();
    }
    // 練習の途中で出たとき、キーコンフィグの捕まえを何も変えずに終える
    if (prev === 'game') keyConfig.cancel();
    if (screen === 'game') {
      // 決定に使った入力を押したまま入っても、離すまで練習の入力にしない。
      // 入った時刻より後に終わるフレームを 1 つ処理するまでは、捕まえ中として扱う
      taintSince = performance.now();
      // 前の練習の入力が残らないよう、履歴をニュートラルの 1 フレームにする
      history.splice(0, history.length, { dir: 5, buttons: [] });
    }
  },
});
gameRoot.hidden = true;

const history: FrameInput[] = [];
/** 通算フレーム番号（毎フレーム 1 ずつ増える） */
let frame = 0;
let prevPadRaw = new Set<number>();
/** パッドごとの前回の「押している入力」（ボタン番号と左スティックの方向）。新しく押された瞬間の判定用 */
const prevPadInputs = new Map<number, Set<string>>();
/** 捕まえ中（と終わった直後）に押していた入力。離すまでゲームの入力に使わない */
let ignore: IgnoreSet = emptyIgnore();
/**
 * game に入った時刻。決定に使った入力を押したまま入っても練習に漏れないよう、
 * frameEnd がこの時刻より後のフレームを 1 つ処理し終えるまで捕まえ中として扱う。null なら不要
 */
let taintSince: number | null = null;
/** 前に見たときキーコンフィグが捕まえ中だった。終わったのを見つけたフレームを捕まえ中として扱うため */
let capturePending = false;
let activeDevice: Device = { kind: 'keyboard' };
/** 前回のパッドのメニュー操作の状態。押した瞬間の取り出し用 */
let prevMenuPad: MenuButtons = NO_MENU_BUTTONS;

/** メニューのキーボード操作。方向はキーコンフィグの割り当ても使う */
function menuActionForKey(e: KeyboardEvent): MenuAction | null {
  if (e.code === 'Enter' || e.code === 'NumpadEnter') return 'confirm';
  if (e.code === 'Escape') return 'back';
  if (e.code === 'ArrowUp' || e.code === bindings.keys.up) return 'up';
  if (e.code === 'ArrowDown' || e.code === bindings.keys.down) return 'down';
  if (e.code === 'ArrowLeft' || e.code === bindings.keys.left) return 'left';
  if (e.code === 'ArrowRight' || e.code === bindings.keys.right) return 'right';
  return null;
}

window.addEventListener('keydown', (e) => {
  if (screens.current() === 'game' || e.repeat) return;
  const action = menuActionForKey(e);
  if (action === null) return;
  // フォーカスしたボタンが Enter で押されたり、Esc が別の動きをしたりしないようにする
  if (action === 'confirm' || action === 'back') e.preventDefault();
  screens.act(action);
});

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
let pad: PadState = readGamepads();
let lastPadTimestamp: number | null = null;

/** パッドを新しく読む。ブラウザでは rAF のときにしか読めない */
function refreshPad(): void {
  pad = readGamepads();
  // この読み取りで捕まえが終わっても、今回の押下はゲームにも操作中のデバイスにも使わない
  const wasCapturing = keyConfig.isCapturing();
  if (wasCapturing) capturePending = true;
  // 練習以外の画面のボタンは、キーコンフィグの割り当てに使わない
  if (screens.current() === 'game') {
    for (const i of pad.rawPressed) if (!prevPadRaw.has(i)) keyConfig.onPadButton(i);
  }
  prevPadRaw = new Set(pad.rawPressed);
  const menuNow: MenuButtons = {
    up: pad.dirs.up,
    down: pad.dirs.down,
    left: pad.dirs.left,
    right: pad.dirs.right,
    confirm: pad.rawPressed.includes(PAD_CONFIRM),
    back: pad.rawPressed.includes(PAD_BACK),
  };
  const menuPressed = menuActions(prevMenuPad, menuNow);
  prevMenuPad = menuNow;
  if (screens.current() !== 'game') screens.actAll(menuPressed);
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
  // 捕まえが終わったのを見つけたフレームだけ、捕まえ中として扱う。
  // キーで終えた場合、そのキーは captureNext が受け取るので timeline に入らず、
  // パッドで終えた場合も、そのボタンはこのフレームに出る。だから 1 フレームで足りる
  const justEndedCapture = !capturing && capturePending;
  capturePending = capturing;
  const filtered = filterInput(
    {
      keys: pressed,
      freshKeys: fresh,
      padButtons: new Set(pad.rawPressed),
      padDirs: new Set<PadDir>(DIRECTION_NAMES.filter((d) => pad.dirs[d])),
    },
    ignore,
    capturing || justEndedCapture || taintSince !== null || screens.current() !== 'game',
  );
  ignore = filtered.ignore;
  if (!capturing && taintSince !== null && end > taintSince) taintSince = null;
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
    // 止まる前後の入力がつながって判定されないよう、履歴を置き換える（同じ配列を使い回す）
    history.splice(0, history.length, ...historyAfterStall(history));
    renderHistory(compressHistory(history, HISTORY_ROWS));
    comboPanel.invalidate(STALL_MESSAGE);
    metrics.onStall();
  }
  metrics.onRaf(now, due.frameEnds.length, due.stalled);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
