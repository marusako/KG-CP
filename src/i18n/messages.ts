import { getLang, type Lang } from './lang';
import type { MeterRun } from '../core/inputMeter';
import { formatAdvantage, type Contact } from '../core/contact';
import type { MoveFrames } from '../core/frameData';

// 画面に出す文の表。ja と en のキーは、Messages の型で同じになるよう縛る。
// 数字などが入る文は関数にする。表記（236K など）とボタン名（LP・HS など）は訳さない。

/** 区間のまとめの文。言語によらず同じ形（例: 2 (3F) → 3 (1F) → 6 (2F) + P） */
function runsText(runs: readonly MeterRun[]): string {
  return runs
    .map((r) => `${r.dir} (${r.frames}F)${r.pressed.map((b) => ` + ${b}`).join('')}`)
    .join(' → ');
}

/** スト6 のボタンの日本語の書き方（通常技の名前で使う） */
const JA_STRENGTH: Readonly<Record<string, string>> = {
  LP: '弱P',
  MP: '中P',
  HP: '強P',
  LK: '弱K',
  MK: '中K',
  HK: '強K',
};

const ja = {
  // 共通
  dir: { up: '上', down: '下', left: '左', right: '右' },
  keyboard: 'キーボード',
  pad: 'パッド',
  back: '戻る',
  /** 一覧を文にするときの区切り */
  listSep: '、',
  /** 方向の並べ方（回転が足りないときの「左・下」） */
  dirSep: '・',
  /** 技の入力が複数あるときの区切り（例: 236S・236HS） */
  inputSep: '・',

  // 表記・レシピの読み込み（core）
  unreadableNotation: (t: string) => `「${t}」は読めない表記です`,
  recipeNotObject: 'レシピはオブジェクトで書いてください',
  recipeIdInvalid: 'id は空でない文字列にしてください',
  recipeNameInvalid: 'name は空でない文字列にしてください',
  recipeStepsInvalid: 'steps は 1 個以上の配列にしてください',
  stepNotObject: (n: number) => `${n}手目: オブジェクトで書いてください`,
  stepInputNotString: (n: number) => `${n}手目: input は文字列で書いてください`,
  stepError: (n: number, error: string) => `${n}手目: ${error}`,
  windowShape: (n: number) => `${n}手目: window は [min, max] の形で書いてください`,
  windowInts: (n: number) => `${n}手目: window は 0 以上の整数で書いてください`,
  windowOrder: (n: number) => `${n}手目: window は min が max 以下になるように書いてください`,
  sampleLoadFailed: (id: string, error: string) => `サンプル ${id} が読めません: ${error}`,

  // ゲーム・コマンド・サンプルの名前
  gameMeltyBlood: 'メルブラ（今後追加）',
  cmd: {
    fireball: '波動',
    reverseFireball: '逆波動',
    dragonPunch: '昇龍',
    halfCircle: '半回転',
    reverseHalfCircle: '逆半回転',
    charge: '溜め',
    rotation: '1回転',
  },
  motionPlusButton: (notation: string) => `${notation} + ボタン`,
  chargePlusButton: (notation: string) => `溜め ${notation} + ボタン`,
  rotationPlusButton: '1回転 + ボタン',
  sampleNames: {
    'sample-1': '小パン2回から波動（サンプル）',
    'sample-2': '立ち中P から昇龍（サンプル）',
    'sample-3': '小足から溜め技（サンプル）',
    'gg-sample-1': '2K から 2D、236S（サンプル）',
    'gg-sample-2': '5P 2回から 623HS（サンプル）',
    'gg-sample-3': '6P から 632146HS（サンプル）',
  },

  // パッド・キーの名前
  touchpad: 'タッチパッド',
  padButtonN: (n: number) => `ボタン ${n}`,
  leftShift: '左Shift',
  rightShift: '右Shift',
  leftCtrl: '左Ctrl',
  rightCtrl: '右Ctrl',
  numpadKey: (n: string) => `テンキー${n}`,

  // キーコンフィグの一括設定
  wizardEscReserved: 'Esc は取り消しに使うので割り当てられません',
  wizardDpadReserved: '十字キーは方向に使うので、ボタンには割り当てられません',
  wizardAlreadyUsed: (action: string) => `すでに ${action} に使っています`,

  // 判定結果
  resultOk: (motion: number, delay: number) => `成立！ モーション ${motion}F / ボタン遅れ ${delay}F`,
  resultNoFirstStep: (expected: string) => `最初の手（${expected}）が入っていません`,
  resultIncomplete: (matched: number, expected: string) =>
    `手が足りません（${matched} 手目まで成功。次は ${expected}）`,
  resultTooSlow: (frames: number) => `モーションが遅すぎます（${frames}F）`,
  resultStepSlow: (from: string, to: string, frames: number, limit: number) =>
    `${from} から ${to} が遅すぎます（${frames}F、猶予 ${limit}F）`,
  resultButtonLate: (frames: number) => `ボタンが遅すぎます（最後の手から ${frames}F）`,
  resultChargeShort: (frames: number) => `溜めが足りません（${frames}F）`,
  resultRotationIncomplete: (missing: string) => `回転が足りません（足りない方向: ${missing}）`,

  // コマンド練習
  practiceTitle: '練習するコマンド',
  practiceSearchPlaceholder: '名前・表記で絞り込み（例: 236、spiral）',
  practiceIdle: 'ボタンを押すと判定します',
  practiceNoMatch: '当たる技がありません',
  recentRateNone: '直近の成功率: -',
  recentRate: (percent: number, ok: number, total: number) => `直近の成功率: ${percent}%（${ok}/${total}）`,

  // コンボトライアル
  comboTitle: 'コンボトライアル',
  comboSearchPlaceholder: '名前・表記で絞り込み（例: 623、2LK）',
  comboJsonPlaceholder: 'レシピの JSON をここに貼り付け',
  comboLoadJson: 'JSON を読み込む',
  comboExportJson: 'JSON に書き出す',
  comboJsonSummary: 'JSON で読み込む・書き出す',
  comboIdle: '最初の手を入力してください',
  comboNoMatch: '当たるコンボがありません',
  comboCharacterNote: 'キャラを選んでいるときは、相手に当たってつながったかで判定します（相手はヒットに固定）',
  comboConnect: 'つなぐ',
  comboWindowFallback: 'このレシピは、フレームデータで判定できない手を含むので、入力のタイミングの窓で判定します',
  comboTiming: (offset: number, window: number) =>
    offset >= 0 ? `最速 +${offset}F（猶予 ${window}F）` : `先行入力 ${-offset}F 前（猶予 ${window}F）`,
  comboStart: '開始',
  comboWindow: (min: number, max: number) => `${min}〜${max}F`,
  comboStats: (attempts: number, completes: number, rate: string) =>
    `挑戦 ${attempts} 回 / 完走 ${completes} 回 / 完走率 ${rate}`,
  comboComplete: '完走！',
  comboStepOk: (n: number) => `${n}手目 成功`,
  comboStepFail: (n: number, reason: string) => `${n}手目 失敗: ${reason}`,
  dropEarly: (frames: number) => `早い（あと ${frames}F 遅く）`,
  dropLate: (min: number, max: number) => `遅い（窓は ${min}〜${max}F）`,
  dropLateBy: (frames: number) => `遅い（${frames}F 遅い）`,
  dropLateRecovered: '遅い（相手が動けるようになった）',
  dropEarlyLost: '早い（先行入力の前に押して、入力が消えた）',
  dropWrong: '違う入力',
  hitBuffered: (shown: string, frames: number) => `${shown}（先行 ${frames}F）`,
  jsonUnreadable: (error: string) => `JSON として読めません: ${error}`,
  idCollision: (id: string) => `id「${id}」は内蔵サンプルと重なっています。別の id にしてください`,
  recipeLoaded: (name: string) => `「${name}」を読み込みました`,
  recipeLoadedNotSaved: (name: string) => `「${name}」を読み込みました（ブラウザへの保存はできませんでした）`,
  recipeExported: '選んでいるレシピを書き出しました',
  unreadableSaved: (n: number) => `読めなかった保存レシピが ${n} 件あります（データは消さずに残しています）`,

  // 入力履歴・計測
  historyTitle: '入力履歴',
  frameMeterTitle: 'フレームメーター',
  frameMeterMoves: (texts: readonly string[]) => texts.join(' → '),
  frameMeterLegend:
    '緑: 発生（数 + 1 が発生のフレーム）　赤: 持続　青: 硬直　灰: 動ける　水色: ジャンプ　橙の枠: 先行入力　黄: 相手の硬直　紫: 相手のダウン　白: ヒットストップ（両者が止まる）',
  cancelPrefix: 'キャンセル: ',
  dummyLabel: '相手',
  dummyHit: 'ヒット',
  dummyBlock: 'ガード',
  dummyLockedCombo: 'コンボトライアル中はヒットに固定',
  noReactionData: '相手の反応のデータなし',
  contactText: (c: Contact) =>
    `${c.kind === 'block' ? 'ガード' : c.knockdown ? 'ダウン' : 'ヒット'}${
      c.combo ? (c.kind === 'block' ? '（連続ガード）' : '（つながった）') : ''
    } ${formatAdvantage(c.advantage)}F`,
  frameMeterEmpty: 'ボタンを押すと、ここに帯が出ます',
  meterRunsText: runsText,
  moveMeterNoCharacter: 'キャラを選ぶと技のフレームが出ます',
  /** 通常技の名前。スト6 のボタンは弱・中・強で書く（GG のボタンはそのまま） */
  normalMoveName: (posture: 'stand' | 'crouch', button: string) =>
    `${posture === 'stand' ? '立ち' : 'しゃがみ'}${JA_STRENGTH[button] ?? button}`,
  // 発生は FAT と同じ数え方（発生前 + 1）で出す。name は技名と入力（例: 立ち弱P (5LP)）
  moveMeterText: (name: string, m: MoveFrames) =>
    `${name} — 発生 ${m.startup + 1}F / 持続 ${m.active}F / 硬直 ${m.recovery}F / 全体 ${m.startup + m.active + m.recovery}F`,
  metricsLabel: ' 計測',
  metricsSteps: (p0: string, p1: string, p2: string, p3: string) =>
    `1回の描画で進んだフレーム数: 0 → ${p0} / 1 → ${p1} / 2 → ${p2} / 3以上 → ${p3}`,
  metricsInterval: (mean: string, hz: string) => `描画の間隔: 平均 ${mean} ms（${hz} Hz）`,
  metricsIntervalNone: '描画の間隔: -',
  metricsKey: (mean: string, max: string) => `キー入力から判定までの遅れ: 平均 ${mean} ms / 最大 ${max} ms`,
  metricsKeyNone: 'キー入力から判定までの遅れ: -',
  metricsPadAbsent: 'パッドの更新間隔: パッドなし',
  metricsPad: (mean: string, max: string) => `パッドの更新間隔: 平均 ${mean} ms / 最大 ${max} ms`,
  metricsPadNone: 'パッドの更新間隔: -',
  metricsStalls: (n: number) => `停止の検出回数: ${n}`,

  // 図
  padDiagramLabel: 'パッドの図',
  keyboardDiagramLabel: 'キーボードの図',

  // キーコンフィグ
  kcTitle: 'キーコンフィグ',
  kcGuide: '操作の名前をクリックすると、その操作だけ直せます（Esc で取り消し）。',
  kcWizard: 'まとめて設定',
  kcWizardKeyboard: 'まとめて設定（キーボード）',
  kcWizardPad: 'まとめて設定（パッド）',
  kcCancel: '取り消し',
  kcClose: '閉じる',
  kcAuto: '自動',
  kcReadout: (device: string, text: string) => `いまの入力（${device}）: ${text}`,
  kcDeviceKeyboard: '操作中: キーボード',
  kcDevicePad: (name: string, family: string) => `操作中: ${name}（${family}）`,
  kcFamily: { xbox: 'Xbox 式', playstation: 'PlayStation 式', unknown: 'ボタン番号表示' },
  kcPressKey: (action: string, n: number, total: number) => `${action} に使うキーを押してください（${n}/${total}）`,
  kcPressButton: (action: string, n: number, total: number) => `${action} に使うボタンを押してください（${n}/${total}）`,
  kcPressEither: (action: string) => `${action} に使うキーかボタンを押してください`,
  kcMissingKeys: (list: string) => `図にないキー: ${list}`,
  kcSwapped: (action: string) => `${action}と入れ替えました`,
  kcDone: '設定しました',

  // 画面（title・設定・クレジットなど）
  appMissing: '#app が見つかりません',
  stalled: '処理が止まったため、この挑戦は無効です',
  tabPractice: 'コマンド練習',
  tabCombo: 'コンボトライアル',
  menuGameSelect: 'ゲーム選択',
  menuSettings: '設定',
  menuCharSelect: 'キャラ選択',
  menuNoCharacter: 'キャラなし（共通）',
  menuCredits: 'クレジット',
  menuVolume: '音量',
  menuLanguage: '言語',
  settingsNote: '効果音はまだありません',
  langSaveFailed: '設定を保存できないため、言語を切り替えられません（ブラウザの保存が無効になっている可能性があります）',
  creditsAuthor: '作者: marusako',
  creditsSource: 'ソースコード: ',
  creditsFrameData: 'フレームデータ: ',
  disclaimer:
    '各ゲームの名称は、それぞれの権利者の商標または登録商標です。このアプリは非公式のファンメイドツールで、権利者とは関係ありません。',
  exitMessage: 'ブラウザ版は、ここからは閉じられません。タブを閉じて終了してください',
  barCharSelect: 'キャラ選択へ',
  barTitle: 'タイトルへ',
  barKeyConfig: 'キーコンフィグ',
  barNoteSf6: '一部の猶予は公開資料の値です（2024年5月時点）',
  barNoteGg: '一部の猶予は有志の資料（Dustloop）の値です',
  barNoteCommon: '猶予は共通の値です',
};

export type Messages = typeof ja;

const en: Messages = {
  dir: { up: 'Up', down: 'Down', left: 'Left', right: 'Right' },
  keyboard: 'Keyboard',
  pad: 'Pad',
  back: 'Back',
  listSep: ', ',
  dirSep: ', ',
  inputSep: '/',

  unreadableNotation: (t) => `"${t}" is not a valid notation`,
  recipeNotObject: 'The recipe must be an object',
  recipeIdInvalid: 'id must be a non-empty string',
  recipeNameInvalid: 'name must be a non-empty string',
  recipeStepsInvalid: 'steps must be an array with at least 1 item',
  stepNotObject: (n) => `Step ${n}: must be an object`,
  stepInputNotString: (n) => `Step ${n}: input must be a string`,
  stepError: (n, error) => `Step ${n}: ${error}`,
  windowShape: (n) => `Step ${n}: window must be in the form [min, max]`,
  windowInts: (n) => `Step ${n}: window must be non-negative integers`,
  windowOrder: (n) => `Step ${n}: window min must not be greater than max`,
  sampleLoadFailed: (id, error) => `Sample ${id} could not be read: ${error}`,

  gameMeltyBlood: 'MELTY BLOOD (coming later)',
  cmd: {
    fireball: 'Fireball',
    reverseFireball: 'Reverse fireball',
    dragonPunch: 'Dragon punch',
    halfCircle: 'Half circle forward',
    reverseHalfCircle: 'Half circle back',
    charge: 'Charge',
    rotation: 'Full circle',
  },
  motionPlusButton: (notation) => `${notation} + button`,
  chargePlusButton: (notation) => `Charge ${notation} + button`,
  rotationPlusButton: '360 + button',
  sampleNames: {
    'sample-1': '2LP x2 into fireball (sample)',
    'sample-2': 'Standing MP into dragon punch (sample)',
    'sample-3': 'Crouching LK into charge move (sample)',
    'gg-sample-1': '2K into 2D, 236S (sample)',
    'gg-sample-2': 'Two 5P into 623HS (sample)',
    'gg-sample-3': '6P into 632146HS (sample)',
  },

  touchpad: 'Touchpad',
  padButtonN: (n) => `Button ${n}`,
  leftShift: 'Left Shift',
  rightShift: 'Right Shift',
  leftCtrl: 'Left Ctrl',
  rightCtrl: 'Right Ctrl',
  numpadKey: (n) => `Numpad ${n}`,

  wizardEscReserved: 'Esc is used to cancel, so it cannot be assigned',
  wizardDpadReserved: 'The D-pad is used for directions, so it cannot be assigned to a button',
  wizardAlreadyUsed: (action) => `Already used for ${action}`,

  resultOk: (motion, delay) => `Success! Motion ${motion}F / button delay ${delay}F`,
  resultNoFirstStep: (expected) => `The first step (${expected}) was not entered`,
  resultIncomplete: (matched, expected) => `Incomplete (cleared step ${matched}; next is ${expected})`,
  resultTooSlow: (frames) => `Motion too slow (${frames}F)`,
  resultStepSlow: (from, to, frames, limit) => `Too slow from ${from} to ${to} (${frames}F, limit ${limit}F)`,
  resultButtonLate: (frames) => `Button too late (${frames}F after the last step)`,
  resultChargeShort: (frames) => `Not charged long enough (${frames}F)`,
  resultRotationIncomplete: (missing) => `Rotation incomplete (missing: ${missing})`,

  practiceTitle: 'Commands to practice',
  practiceSearchPlaceholder: 'Filter by name or notation (e.g. 236, spiral)',
  practiceIdle: 'Press a button to check',
  practiceNoMatch: 'No matching moves',
  recentRateNone: 'Recent success rate: -',
  recentRate: (percent, ok, total) => `Recent success rate: ${percent}% (${ok}/${total})`,

  comboTitle: 'Combo trial',
  comboSearchPlaceholder: 'Filter by name or notation (e.g. 623, 2LK)',
  comboJsonPlaceholder: 'Paste a recipe JSON here',
  comboLoadJson: 'Load JSON',
  comboExportJson: 'Export as JSON',
  comboJsonSummary: 'Load / export JSON',
  comboIdle: 'Enter the first step',
  comboNoMatch: 'No matching combos',
  comboCharacterNote: 'With a character selected, steps are judged by whether they hit and combo (the opponent is fixed to Hit)',
  comboConnect: 'Connect',
  comboWindowFallback: 'This recipe has steps the frame data cannot judge, so it is judged by input timing windows',
  comboTiming: (offset, window) =>
    offset >= 0 ? `+${offset}F from earliest (window ${window}F)` : `Buffered ${-offset}F early (window ${window}F)`,
  comboStart: 'Start',
  comboWindow: (min, max) => `${min}-${max}F`,
  comboStats: (attempts, completes, rate) => `Attempts ${attempts} / Completed ${completes} / Rate ${rate}`,
  comboComplete: 'Complete!',
  comboStepOk: (n) => `Step ${n} OK`,
  comboStepFail: (n, reason) => `Step ${n} failed: ${reason}`,
  dropEarly: (frames) => `Too early (press ${frames}F later)`,
  dropLate: (min, max) => `Too late (window ${min}-${max}F)`,
  dropLateBy: (frames) => `Too late (${frames}F late)`,
  dropLateRecovered: 'Too late (the opponent recovered)',
  dropEarlyLost: 'Too early (pressed before the input buffer, the input was lost)',
  dropWrong: 'Wrong input',
  hitBuffered: (shown, frames) => `${shown} (buffered ${frames}F early)`,
  jsonUnreadable: (error) => `Could not read as JSON: ${error}`,
  idCollision: (id) => `The id "${id}" is already used by a built-in sample. Use a different id`,
  recipeLoaded: (name) => `Loaded "${name}"`,
  recipeLoadedNotSaved: (name) => `Loaded "${name}" (could not save to the browser)`,
  recipeExported: 'Exported the selected recipe',
  unreadableSaved: (n) => `${n} saved recipe(s) could not be read (the data is kept, not deleted)`,

  historyTitle: 'Input history',
  frameMeterTitle: 'Frame meter',
  frameMeterMoves: (texts) => texts.join(' → '),
  frameMeterLegend:
    'Green: startup (number + 1 is the startup frame)  Red: active  Blue: recovery  Gray: free  Cyan: jump  Orange frame: buffered input  Yellow: opponent stun  Purple: opponent knockdown  White: hitstop (both freeze)',
  cancelPrefix: 'Cancel: ',
  dummyLabel: 'Opponent',
  dummyHit: 'Hit',
  dummyBlock: 'Block',
  dummyLockedCombo: 'Fixed to Hit during combo trials',
  noReactionData: 'No reaction data',
  contactText: (c) =>
    `${c.kind === 'block' ? 'Block' : c.knockdown ? 'Knockdown' : 'Hit'}${
      c.combo ? (c.kind === 'block' ? ' (blockstring)' : ' (combo)') : ''
    } ${formatAdvantage(c.advantage)}F`,
  frameMeterEmpty: 'Press a button to start the meter',
  meterRunsText: runsText,
  moveMeterNoCharacter: 'Choose a character to see move frames',
  normalMoveName: (posture, button) => `${posture === 'stand' ? 'Standing' : 'Crouching'} ${button}`,
  moveMeterText: (name, m) =>
    `${name} — Startup ${m.startup + 1}F / Active ${m.active}F / Recovery ${m.recovery}F / Total ${m.startup + m.active + m.recovery}F`,
  metricsLabel: ' Metrics',
  metricsSteps: (p0, p1, p2, p3) => `Frames advanced per render: 0 → ${p0} / 1 → ${p1} / 2 → ${p2} / 3+ → ${p3}`,
  metricsInterval: (mean, hz) => `Render interval: avg ${mean} ms (${hz} Hz)`,
  metricsIntervalNone: 'Render interval: -',
  metricsKey: (mean, max) => `Key press to judgment delay: avg ${mean} ms / max ${max} ms`,
  metricsKeyNone: 'Key press to judgment delay: -',
  metricsPadAbsent: 'Pad update interval: no pad',
  metricsPad: (mean, max) => `Pad update interval: avg ${mean} ms / max ${max} ms`,
  metricsPadNone: 'Pad update interval: -',
  metricsStalls: (n) => `Stalls detected: ${n}`,

  padDiagramLabel: 'Pad diagram',
  keyboardDiagramLabel: 'Keyboard diagram',

  kcTitle: 'Key config',
  kcGuide: 'Click an action name to change just that one (Esc to cancel).',
  kcWizard: 'Set all',
  kcWizardKeyboard: 'Set all (keyboard)',
  kcWizardPad: 'Set all (pad)',
  kcCancel: 'Cancel',
  kcClose: 'Close',
  kcAuto: 'Auto',
  kcReadout: (device, text) => `Current input (${device}): ${text}`,
  kcDeviceKeyboard: 'Active: keyboard',
  kcDevicePad: (name, family) => `Active: ${name} (${family})`,
  kcFamily: { xbox: 'Xbox style', playstation: 'PlayStation style', unknown: 'Button numbers' },
  kcPressKey: (action, n, total) => `Press the key for ${action} (${n}/${total})`,
  kcPressButton: (action, n, total) => `Press the button for ${action} (${n}/${total})`,
  kcPressEither: (action) => `Press the key or button for ${action}`,
  kcMissingKeys: (list) => `Keys not in the diagram: ${list}`,
  kcSwapped: (action) => `Swapped with ${action}`,
  kcDone: 'Saved',

  appMissing: '#app not found',
  stalled: 'Processing stalled, so this attempt is invalid',
  tabPractice: 'Command practice',
  tabCombo: 'Combo trial',
  menuGameSelect: 'Game select',
  menuSettings: 'Settings',
  menuCharSelect: 'Character select',
  menuNoCharacter: 'No character (generic)',
  menuCredits: 'Credits',
  menuVolume: 'Volume',
  menuLanguage: 'Language',
  settingsNote: 'There are no sound effects yet',
  langSaveFailed: "Couldn't save settings, so the language can't be changed (browser storage may be disabled)",
  creditsAuthor: 'Author: marusako',
  creditsSource: 'Source code: ',
  creditsFrameData: 'Frame data: ',
  disclaimer:
    'Each game name is a trademark or registered trademark of its respective owner. This app is an unofficial fan-made tool and is not affiliated with any owner.',
  exitMessage: 'The browser version cannot be closed from here. Please close the tab to exit',
  barCharSelect: 'To character select',
  barTitle: 'To title',
  barKeyConfig: 'Key config',
  barNoteSf6: 'Some input windows are based on public data (as of May 2024)',
  barNoteGg: 'Some input windows are based on community data (Dustloop)',
  barNoteCommon: 'Input windows use shared default values',
};

const TABLES: Readonly<Record<Lang, Messages>> = { ja, en };

/** 言語の表。lang を省くと、いまの言語（getLang()） */
export function msg(lang: Lang = getLang()): Messages {
  return TABLES[lang];
}
