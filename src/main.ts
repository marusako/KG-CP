import './ui/style.css';
import { getLang, langFromBrowser, setLang, type Lang } from './i18n/lang';
import { msg } from './i18n/messages';
import { pick } from './i18n/localized';
import { analyzeAttempt } from './core/detect';
import { compressHistory, historyAfterStall } from './core/history';
import { createFrameClock, dueFrames, type FrameClock } from './core/clock';
import type { FrameInput, PracticeDef } from './core/types';
import { dropDisconnected, nextActiveDevice, type Device } from './input/activeDevice';
import {
  INITIAL_GATE,
  emptyIgnore,
  filterInput,
  gateEnterGame,
  gateFrame,
  gateSawCapturing,
  type IgnoreSet,
  type PadDir,
} from './input/captureFilter';
import { DIRECTION_NAMES, loadBindings } from './input/bindings';
import { resolveDirection } from './input/direction';
import { readGamepads, type PadInfo, type PadState } from './input/gamepad';
import { KeyboardReader } from './input/keyboard';
import { detectPadFamily } from './input/padLayout';
import type { Distance } from './core/settings';
import { findCharacter, moveToPractice, type CharacterData } from './core/characters';
import { INITIAL_FIGHTER, moveDisplayName, noDataMove, stepFighter, type FighterState } from './core/fighter';
import { contactReaction, fighterDataFor, type DummyMode, type FighterData } from './core/frameData';
import { IDLE_OUTCOME, moveMatchesCommand, stepMoveOutcome, type OutcomeState } from './core/moveOutcome';
import { INITIAL_DUMMY, stepDummy, type DummyState } from './core/dummy';
import { judgePracticeFollowUp, type FollowUpJudge } from './core/followUp';
import type { SimFrame } from './core/comboSim';
import { EMPTY_FRAME_METER, stepFrameMeter, stopFrameMeter, syncMoveTexts, type FrameMeterState } from './core/frameMeter';
import { PROFILES, profileFor, type GameProfile, type PlayableGameId } from './core/profiles';
import type { GameId } from './core/games';
import { NO_MENU_BUTTONS, menuActions, type MenuAction, type MenuButtons } from './core/menu';
import { DEFAULT_SETTINGS, parseSettings, serializeSettings, type Settings } from './core/settings';
import { createCommandPanel } from './ui/commandPanel';
import { createComboPanel } from './ui/comboPanel';
import { createHistoryView } from './ui/historyView';
import { createFrameMeterView } from './ui/frameMeterView';
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
/** 言語を変えて読み直したあと、設定画面を開くための印（1 回だけ使う） */
const REOPEN_SETTINGS_KEY = 'kgcp.reopenSettings';

/** 保存がないとき（初めて開いたとき）の言語は、ブラウザの言語から決める */
function loadSettings(): Settings {
  const fallbackLang = langFromBrowser(navigator.language);
  try {
    return parseSettings(localStorage.getItem(SETTINGS_KEY), fallbackLang);
  } catch {
    return { ...DEFAULT_SETTINGS, lang: fallbackLang };
  }
}

/** 保存できたら true。localStorage が使えなくても動作は続ける */
function saveSettings(s: Settings): boolean {
  try {
    localStorage.setItem(SETTINGS_KEY, serializeSettings(s));
    return true;
  } catch {
    return false;
  }
}

let settings = loadSettings();
// 文はすべて msg() から取るので、画面を作る前に言語を決める
setLang(settings.lang);
document.documentElement.lang = settings.lang;

const app = document.getElementById('app');
if (!app) throw new Error(msg().appMissing);

const keyboard = new KeyboardReader(window);
const metrics = createMetricsPanel(document.body);

/**
 * 言語を変えたら保存して読み直す（画面を作り直す手間を省くため）。
 * 保存できないと、読み直しで元の言語に戻ってしまうので、読み直さずに false を返す
 */
function changeLang(lang: Lang): boolean {
  if (!saveSettings({ ...settings, lang })) return false;
  settings = { ...settings, lang };
  try {
    sessionStorage.setItem(REOPEN_SETTINGS_KEY, '1');
  } catch {
    // 使えないときは、読み直したあとタイトルに戻る
  }
  location.reload();
  return true;
}

/** いまのゲームの設定と、そのゲームのキーの割り当て */
let profile: GameProfile = profileFor(settings.lastGame) ?? PROFILES.sf6;
let bindings = loadBindings(profile);

/** いま練習しているキャラ。null はキャラなし */
let character: CharacterData | null = findCharacter(profile.id, settings.lastCharacter[profile.id]) ?? null;

/** 技のフレームデータを持つキャラ（データのないキャラ・キャラなしは null） */
function fighterOf(c: CharacterData | null): { data: FighterData; character: CharacterData } | null {
  const data = c === null ? undefined : fighterDataFor(c.id);
  return c !== null && data !== undefined ? { data, character: c } : null;
}
let fighter = fighterOf(character);
/** 近S・遠S（c.S・f.S）があるキャラか（距離の切り替えを出すか） */
function hasRangedMoves(f: { data: FighterData } | null): boolean {
  return f?.data.moves.some((m) => m.input === 'c.S' || m.input === 'f.S') ?? false;
}
/** いま技の選びに使う距離。練習のタブは設定の値、コンボのタブはレシピに合わせた値 */
let distance: Distance = settings.distance;
/** キャラの状態・相手の状態と、フレームメーターの帯 */
let fighterState: FighterState = INITIAL_FIGHTER;
let dummyState: DummyState = INITIAL_DUMMY;
let frameMeter: FrameMeterState = EMPTY_FRAME_METER;
/** 帯の starts と同じ順の、技の文（技が始まったときに作っておく。毎フレーム作らない） */
let moveTexts: readonly string[] = [];
/** moveTexts に当たり方の結果を足して、つないだ、帯の下の 1 行目 */
let movesLine = '';
/** フレームデータのない技を入れたときの注記（名前つきの文）と、そのとき帯にあった技の数。次に技が始まる・新しい帯になると消す */
let noDataNote: { text: string; starts: number } | null = null;

/** コマンド練習の出た技の追いかけ。command は、待っている試しで選んでいた技 */
let outcome: { state: OutcomeState; command: PracticeDef | null } = { state: IDLE_OUTCOME, command: null };

/** 出た技を 1 フレーム進め、試しがあれば行を書き換える（技の途中に押したときは待つ文、決まったらその文） */
function stepOutcome(before: FighterState, after: FighterState, attempt: boolean): void {
  if (fighter === null) return;
  const command = panel.selected();
  // 選んだ技にデータがないときは、試しのたびに「分からない」を出し、追いかけない（派生の項目は、派生の技が必ずデータにある）
  if (attempt && command.kind !== 'followUp' && !fighter.data.moves.some((m) => moveMatchesCommand(m, command, profile))) {
    outcome = { state: IDLE_OUTCOME, command: null };
    panel.showOutcome(msg().outcomeNoData);
    return;
  }
  const attemptCommand = attempt ? command : outcome.command;
  const r = stepMoveOutcome(outcome.state, before, after, attempt);
  outcome = { state: r.state, command: attemptCommand };
  // 技を選び直したあとに決まった前の試しは、出さない
  if (attemptCommand !== command) return;
  const o = r.outcome;
  if (o === null) {
    if (attempt && r.state.kind === 'pending') panel.showOutcome(msg().outcomePending);
    return;
  }
  panel.showOutcome(
    o.kind === 'move'
      ? msg().outcomeMove(
          moveDisplayName(o.move, fighter.character, profile, getLang()),
          o.via,
          !moveMatchesCommand(o.move, command, profile),
        )
      : msg().outcomeNone(o.reason),
  );
}

/** キャラ・相手の状態と帯を最初に戻す（キャラやゲーム・相手の切り替え、練習画面に入ったとき） */
function resetFighter(): void {
  fighterState = INITIAL_FIGHTER;
  dummyState = INITIAL_DUMMY;
  frameMeter = EMPTY_FRAME_METER;
  moveTexts = [];
  movesLine = '';
  noDataNote = null;
  outcome = { state: IDLE_OUTCOME, command: null };
}

/** キャラの技を、コマンド練習の一覧（読めないものは除く）と注記にする */
function practiceOf(p: GameProfile, c: CharacterData | null): { commands: PracticeDef[]; notes: Map<string, string> } {
  if (c === null) return { commands: [...p.practiceCommands], notes: new Map() };
  const commands = c.moves.flatMap((m) => moveToPractice(m, p) ?? []);
  const notes = new Map(c.moves.flatMap((m) => (m.note === undefined ? [] : [[m.id, pick(m.note, getLang())] as const])));
  return { commands, notes };
}

/** game に入るとき、前と違うゲーム・キャラなら、パネルを作り直さずに中身を入れ替える */
function switchPractice(next: GameProfile, nextCharacter: CharacterData | null): void {
  const gameChanged = next.id !== profile.id;
  if (!gameChanged && nextCharacter?.id === character?.id) return;
  profile = next;
  character = nextCharacter;
  fighter = fighterOf(nextCharacter);
  frameMeterView.setDistanceAvailable(hasRangedMoves(fighter));
  resetFighter();
  const { commands, notes } = practiceOf(next, nextCharacter);
  panel.setCommands(commands, notes);
  comboPanel.setProfile(next, nextCharacter ?? undefined);
  if (gameChanged) {
    bindings = loadBindings(next);
    keyConfig.setProfile(next, bindings);
  }
}

/** 検索欄にフォーカスがあるか（文字を打っている間は練習の入力にしない） */
function isSearchFocused(): boolean {
  return document.activeElement instanceof HTMLElement && document.activeElement.classList.contains('search-input');
}

/**
 * 練習画面（game のときだけ見せる）。上から、画面操作のバー・3 つの枠（入力履歴・状態表示・選択）・フレームメーター。
 * キーコンフィグは、3 つの枠とメーターの上に重ねる層（ふだんは隠す）
 */
const gameRoot = document.createElement('div');
gameRoot.className = 'game-root';
app.append(gameRoot);

const gameBar = createGameBar(gameRoot, {
  onCharSelect: () => {
    screens.show('charSelect');
  },
  onBack: () => {
    screens.show('title');
  },
  onKeyConfig: () => {
    setKeyConfigOpen(!keyConfigOpen);
  },
});
gameBar.setGame(profile.id, character ? pick(character.name, getLang()) : undefined);

const gameMain = document.createElement('div');
gameMain.className = 'game-main';
gameRoot.append(gameMain);
const renderHistory = createHistoryView(gameMain);
const statusColumn = document.createElement('div');
statusColumn.className = 'game-column';
const selectColumn = document.createElement('div');
selectColumn.className = 'game-column';
gameMain.append(statusColumn, selectColumn);
/** タブごとに、状態表示の枠と選択の枠に 1 つずつ置く入れ物 */
function tabPane(column: HTMLElement): HTMLElement {
  const pane = document.createElement('div');
  pane.className = 'tab-pane';
  column.append(pane);
  return pane;
}
const practiceRoots = { status: tabPane(statusColumn), select: tabPane(selectColumn) };
const comboRoots = { status: tabPane(statusColumn), select: tabPane(selectColumn) };
const initialPractice = practiceOf(profile, character);
const panel = createCommandPanel(practiceRoots, initialPractice.commands, initialPractice.notes);
const comboPanel = createComboPanel(comboRoots, profile, character ?? undefined);
const frameMeterView = createFrameMeterView(gameRoot, settings.dummyMode, (dummyMode) => {
  settings = { ...settings, dummyMode };
  saveSettings(settings);
  resetFighter();
}, settings.distance, (next) => {
  settings = { ...settings, distance: next };
  saveSettings(settings);
  resetFighter();
});
frameMeterView.setDistanceAvailable(hasRangedMoves(fighter));

const keyConfigLayer = document.createElement('div');
keyConfigLayer.className = 'kc-layer';
keyConfigLayer.hidden = true;
const keyConfigDialog = document.createElement('div');
keyConfigDialog.className = 'kc-dialog';
const keyConfigClose = document.createElement('button');
keyConfigClose.className = 'kc-close';
keyConfigClose.textContent = msg().kcClose;
keyConfigClose.addEventListener('click', () => {
  keyConfigClose.blur();
  setKeyConfigOpen(false);
});
keyConfigDialog.append(keyConfigClose);
keyConfigLayer.append(keyConfigDialog);
gameRoot.append(keyConfigLayer);
const keyConfig = createKeyConfig(keyConfigDialog, profile, bindings, keyboard);

/** キーコンフィグの層を開いているか */
let keyConfigOpen = false;
/**
 * キーコンフィグの層を開く・閉じる。閉じるとき、入力待ち・一括設定の途中なら取り消す。
 * 開いている間、層の後ろ（3 つの枠とメーター）は inert にして、Tab で後ろの検索欄に入れないようにする
 * （入ると練習の入力が止まるため）。バーはそのまま押せる
 */
function setKeyConfigOpen(open: boolean): void {
  if (!open) keyConfig.cancel();
  keyConfigOpen = open;
  keyConfigLayer.hidden = !open;
  for (const child of gameRoot.children) {
    if (child instanceof HTMLElement && child !== gameBar.el && child !== keyConfigLayer) child.inert = open;
  }
}

type Tab = 'practice' | 'combo';
let activeTab: Tab = 'practice';
const tabDefs: readonly (readonly [Tab, string, readonly HTMLElement[]])[] = [
  ['practice', msg().tabPractice, [practiceRoots.status, practiceRoots.select]],
  ['combo', msg().tabCombo, [comboRoots.status, comboRoots.select]],
];
const tabButtons = tabDefs.map(([tab, label]) => {
  const b = document.createElement('button');
  b.textContent = label;
  b.addEventListener('click', () => {
    activeTab = tab;
    comboPanel.reset();
    // 相手の切り替えはコンボトライアルの間だけ固定する（設定は変えない）。前のタブの途中の状態は持ち越さない
    resetFighter();
    frameMeterView.setDummyLocked(tab === 'combo');
    frameMeterView.setDistanceLocked(tab === 'combo');
    showTab();
    b.blur();
  });
  return b;
});
function showTab(): void {
  tabDefs.forEach(([tab, , panes], i) => {
    for (const pane of panes) pane.hidden = tab !== activeTab;
    tabButtons[i]?.classList.toggle('active', tab === activeTab);
  });
}
gameBar.tabs.append(...tabButtons);
showTab();

const screens = createScreens(app, {
  getSettings: () => settings,
  onVolume: (volume) => {
    settings = { ...settings, volume };
    saveSettings(settings);
  },
  onLang: changeLang,
  onSelectGame: (id: GameId) => {
    settings = { ...settings, lastGame: id };
    saveSettings(settings);
  },
  onSelectCharacter: (game: PlayableGameId, characterId: string | null) => {
    const { [game]: _old, ...rest } = settings.lastCharacter;
    settings = { ...settings, lastCharacter: characterId === null ? rest : { ...rest, [game]: characterId } };
    saveSettings(settings);
    const chosen = findCharacter(game, characterId);
    gameBar.setGame(game, chosen ? pick(chosen.name, getLang()) : undefined);
  },
  onScreen: (screen: Screen, prev: Screen) => {
    gameRoot.hidden = screen !== 'game';
    if (screen === 'game') {
      const next = profileFor(settings.lastGame);
      if (next) switchPractice(next, findCharacter(next.id, settings.lastCharacter[next.id]) ?? null);
    }
    if (screen === 'game' || prev === 'game') {
      // 練習の途中の状態は捨てる
      comboPanel.reset();
    }
    // 練習の途中で出たとき、キーコンフィグの捕まえを何も変えずに終え、層も閉じる
    if (prev === 'game') setKeyConfigOpen(false);
    if (screen === 'game') {
      // 決定に使った入力を押したまま入っても、離すまで練習の入力にしない。
      // 入った時刻より後に終わるフレームを 1 つ処理するまでは、捕まえ中として扱う
      gate = gateEnterGame(gate, performance.now());
      // 前の練習の入力が残らないよう、履歴をニュートラルの 1 フレームにする
      history.splice(0, history.length, { dir: 5, buttons: [] });
      resetFighter();
    }
  },
});
gameRoot.hidden = true;

/** 言語を変えて読み直したところなら true（印は 1 回で消す）。sessionStorage が使えなければ false（タイトルのまま） */
function takeReopenSettingsMark(): boolean {
  try {
    if (sessionStorage.getItem(REOPEN_SETTINGS_KEY) === null) return false;
    sessionStorage.removeItem(REOPEN_SETTINGS_KEY);
    return true;
  } catch {
    return false;
  }
}
// 画面の切り替えは try の外で行う（そこで起きた例外を握りつぶさないため）
if (takeReopenSettingsMark()) screens.showLanguageSetting();

const history: FrameInput[] = [];
/** 通算フレーム番号（毎フレーム 1 ずつ増える） */
let frame = 0;
let prevPadRaw = new Set<number>();
/** パッドごとの前回の「押している入力」（ボタン番号と左スティックの方向）。新しく押された瞬間の判定用 */
const prevPadInputs = new Map<number, Set<string>>();
/** 捕まえ中（と終わった直後）に押していた入力。離すまでゲームの入力に使わない */
let ignore: IgnoreSet = emptyIgnore();
/** 入力を捨てるフレームの判断の状態（捕まえ中・game に入った直後） */
let gate = INITIAL_GATE;
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
  const wasCapturing = keyConfig.isCapturing() || isSearchFocused();
  if (wasCapturing) gate = gateSawCapturing(gate);
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

/** いまの相手の切り替え。コンボトライアルのタブの間は「ヒット」に固定（設定の dummyMode は変えない） */
function currentDummyMode(): DummyMode {
  return activeTab === 'combo' ? 'hit' : settings.dummyMode;
}

/** 技の文の後ろにつける結果（キャンセルで出した技の頭には、updateMoveTexts が cancelPrefix を付ける）。当たったら当たり方、いまの切り替えで反応のデータがなければその知らせ、そうでなければ空 */
function resultText(start: FrameMeterState['starts'][number]): string {
  if (start.contact !== undefined) return ` / ${msg().contactText(start.contact)}`;
  return contactReaction(start.move, currentDummyMode()) === null ? ` / ${msg().noReactionData}` : '';
}

/**
 * 帯が変わったとき、技の文を帯の starts に合わせる（決まりは syncMoveTexts。文は技が始まったときに 1 回だけ作る）。
 * 結果の文は、starts が変わったとき（技が始まった・当たった・古い技が外れた・新しい帯になった）に付け直す。
 * 文の並びが同じでも starts が変わったら作り直す（新しい帯を前と同じ技で始めたとき、前の帯の結果を残さないため）
 */
function updateMoveTexts(before: FrameMeterState): void {
  const current = fighter;
  const texts = syncMoveTexts(moveTexts, before, frameMeter, (move) =>
    current === null ? move.input : msg().moveMeterText(moveDisplayName(move, current.character, profile, getLang()), move),
  );
  if (texts === moveTexts && frameMeter.starts === before.starts) return;
  moveTexts = texts;
  movesLine = msg().frameMeterMoves(texts.map((t, i) => {
    const start = frameMeter.starts[i] as FrameMeterState['starts'][number];
    return (start.cancel === true ? msg().cancelPrefix : '') + t + resultText(start);
  }));
}

function stepFrame(end: number): void {
  // キーボードとパッドは OR で合成
  const { pressed, fresh, downTimes } = keyboard.sample(end);
  // キー入力から、そのイベントを取り出したフレームを処理するまでの遅れ（計測パネル用）
  const processedAt = performance.now();
  for (const t of downTimes) metrics.onKeyLatency(processedAt - t);
  // キーコンフィグで入力待ちの間や検索欄に文字を打っている間と、その間に押していた入力を離すまでは、ゲームの入力に使わない
  const capturing = keyConfig.isCapturing() || isSearchFocused();
  const gated = gateFrame(gate, { capturing, onGameScreen: screens.current() === 'game', frameEnd: end });
  gate = gated.state;
  const filtered = filterInput(
    {
      keys: pressed,
      freshKeys: fresh,
      padButtons: new Set(pad.rawPressed),
      padDirs: new Set<PadDir>(DIRECTION_NAMES.filter((d) => pad.dirs[d])),
    },
    ignore,
    gated.block,
  );
  ignore = filtered.ignore;
  const { input } = filtered;
  const on = (d: PadDir): boolean => input.keys.has(bindings.keys[d] as string) || input.padDirs.has(d);
  const dir = resolveDirection({ up: on('up'), down: on('down'), left: on('left'), right: on('right') }, 'neutral');
  const buttons = profile.buttons.filter(
    (b) => input.keys.has(bindings.keys[b] as string) || input.padButtons.has(bindings.pad[b] as number),
  );
  history.push({ dir, buttons });
  if (history.length > MAX_FRAMES) history.shift();

  // コマンド練習の判定は、キャラの動きより先に求める（結果があったフレームを、出た技の追いかけに渡すため）
  // 派生の項目（kind 'followUp'）は analyzeAttempt が null を返す。キャラの動きが決まったあとに、judgePracticeFollowUp で判定する
  const practiceSelected = panel.selected();
  const attemptResult = activeTab === 'combo' || practiceSelected.kind === 'followUp' ? null : analyzeAttempt(history, practiceSelected);
  let followUpJudge: FollowUpJudge | null = null;

  // 練習画面の外では、キャラも帯も進めない（入ると最初に戻すので、外の入力は残らない）
  let sim: SimFrame | null = null;
  if (screens.current() === 'game') {
    const before = fighterState;
    const dummyBefore = dummyState;
    // 距離: 練習のタブは設定の値、コンボのタブはレシピの次の手に合わせる（見た目も合わせる）
    distance = activeTab === 'combo' ? comboPanel.distanceFor(distance, before) : settings.distance;
    frameMeterView.setDistance(distance);
    const stepped = stepFighter(before, history, fighter, profile, profile.inputBuffer, distance);
    const hit = stepDummy(dummyState, stepped, currentDummyMode());
    fighterState = hit.fighter;
    dummyState = hit.dummy;
    if (fighter !== null) sim = { frame, before, after: hit.fighter, dummyBefore, dummyAfter: hit.dummy, contact: hit.contact };
    const prevMeter = frameMeter;
    frameMeter = stepFrameMeter(prevMeter, before, fighterState, history, { dummy: dummyState, contact: hit.contact });
    if (frameMeter !== prevMeter) updateMoveTexts(prevMeter);
    // フレームデータのない技の注記: 次に帯に技が始まる・新しい帯になったら消す。キャラなしでは調べない
    if (noDataNote !== null && (frameMeter.starts.length !== noDataNote.starts || (!prevMeter.recording && frameMeter.recording))) {
      noDataNote = null;
    }
    if (fighter !== null) {
      const missing = noDataMove(history, fighter.data, fighter.character, profile);
      const def = missing === null ? null : moveToPractice(missing, profile);
      if (def !== null) noDataNote = { text: msg().meterNoData(def.name), starts: frameMeter.starts.length };
    }
    if (activeTab !== 'combo' && fighter !== null && practiceSelected.kind === 'followUp') {
      followUpJudge = judgePracticeFollowUp(practiceSelected, fighter.data, profile, history, before, hit.fighter);
    }
    if (activeTab !== 'combo' && fighter !== null) {
      const cameOut = hit.fighter.cancelTo ?? hit.fighter.move;
      if (followUpJudge?.ok === true && cameOut !== null) {
        // 派生が出た（ヒットストップ中の予約を含む）。同じフレームの先行入力の待ちなどは出さない
        outcome = { state: IDLE_OUTCOME, command: null };
        panel.showOutcome(msg().outcomeMove(moveDisplayName(cameOut, fighter.character, profile, getLang()), 'direct', false));
      } else {
        stepOutcome(before, hit.fighter, attemptResult !== null || followUpJudge !== null);
      }
    }
  }
  // コンボトライアルは、キャラと相手の動きが決まったあとに判定する（相手に当たってつながったかを見るため）
  if (activeTab === 'combo') {
    comboPanel.step(history, frame, sim);
  } else {
    if (attemptResult) panel.showResult(attemptResult);
    else if (followUpJudge) panel.showFollowUp(followUpJudge);
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
    comboPanel.invalidate(msg().stalled);
    // 止まる前後の入力がつながらないよう、積んでいる途中なら帯を止めてキャラを最初に戻す
    frameMeter = stopFrameMeter(frameMeter);
    fighterState = INITIAL_FIGHTER;
    dummyState = INITIAL_DUMMY;
    metrics.onStall();
  }
  // 描くのは練習画面にいるときだけ。前と同じ中身なら何もしない
  if (screens.current() === 'game') frameMeterView.render(frameMeter, movesLine, fighter === null ? msg().moveMeterNoCharacter : (noDataNote?.text ?? ''));
  metrics.onRaf(now, due.frameEnds.length, due.stalled);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
