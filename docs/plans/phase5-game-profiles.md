# 第5段階 ②: ゲームごとのボタンとコマンド

## 目的

タイトルで選んだゲームによって、練習画面の中身を切り替える。

- ボタン: スト6 は LP・MP・HP・LK・MK・HK、GG（GUILTY GEAR -STRIVE-）は P・K・S・HS・D
- コマンドの一覧・コンボのサンプル・コンボの表記
- キーの割り当て（ゲームごとに別に保存）
- 自分で読み込んだコンボのレシピ（ゲームごとに別に保存）

猶予の数値は変えない（3 段目）。GG のコマンドも、今の共通の猶予を使う。

あわせて、① のレビューの提案「入力を捨てるフレームの判断を、純粋な関数に切り出してテストする」を行う。

## 構成

```
src/core/notation.ts   表記の読み方をゲームに合わせる（変更）
src/core/commands.ts   SF6_COMMANDS と GG_COMMANDS（変更。DEFAULT_COMMANDS は SF6_COMMANDS に名前を変える）
src/core/samples.ts    SF6_SAMPLES と GG_SAMPLES（変更。SAMPLE_RECIPES は SF6_SAMPLES に名前を変える）
src/core/profiles.ts   ゲームごとの設定をまとめる（新規）
src/core/combo.ts      parseRecipe が表記のルールを受け取る（変更）
src/core/types.ts      CommandDef に notation を足す（変更）
src/input/bindings.ts  ボタンをゲームから受け取る形にする（変更）
src/input/wizard.ts    まとめて設定の順番をゲームから受け取る（変更）
src/input/captureFilter.ts  gateFrame を足す（変更）
src/ui/*.ts, src/main.ts    ゲームを切り替える（変更）
tests/: 既存のテストを新しい形に合わせて直し、足す
```

## テストのコマンド

- `npm test`・`npm run typecheck`・`npm run build` がすべて終了コード 0

## 外から見える形（API）

### コマンドの定義（`src/core/types.ts`）

`CommandDef` の両方の形に、表記のときの方向の部分 `notation: string` を足す。例: 236P は `'236'`、[4]6P は `'[4]6'`、[2]8K は `'[2]8'`、360P は `'360'`。

### 表記のルール（`src/core/notation.ts`）

```ts
export interface NotationRules {
  /** ボタンの名前 */
  buttons: readonly string[];
  /** まとめ書き。例: スト6 の 'P' は ['LP','MP','HP']。GG にはない */
  buttonGroups: Readonly<Record<string, readonly string[]>>;
  commands: readonly CommandDef[];
}

/**
 * 表記（例: 2LP, 236HP, [4]6P, 2D, 236HS）を入力の条件に読み替える。
 * - 末尾のボタンの部分は、buttons と buttonGroups の名前のうち、いちばん長く一致するもの（'HS' は 'S' より先）
 * - 方向の部分が 1〜9 の 1 文字なら通常技。2 はしゃがみとして [1,2,3]。ボタンはまとめ書きなら中身、そうでなければその 1 つ
 * - それ以外は、notation が方向の部分と同じコマンドを探す。
 *   まとめ書きなら、その中身とコマンドの buttons の重なり（空なら読めない）。
 *   1 つのボタンなら、それがコマンドの buttons に入っていること（入っていなければ読めない）
 * - 読めなければ { ok: false, error: '「…」は読めない表記です' }
 */
export function parseStep(text: string, rules: NotationRules):
  { ok: true; input: StepInput } | { ok: false; error: string };
```

`StepInput` の形は今のまま。

### コマンドとサンプル（`src/core/commands.ts`・`src/core/samples.ts`）

- `SF6_COMMANDS`: 今の DEFAULT_COMMANDS と同じ中身に notation を足したもの（id・名前・猶予・ボタンは変えない）
- `GG_COMMANDS`: 次の 10 個。ボタンはすべて `['P','K','S','HS','D']`。猶予は SF6_COMMANDS と同じ共通の値（短いモーションは MOTION_WINDOW、41236・63214・632146・236236・214214 は LONG_MOTION_WINDOW、溜めは minHold 40、360 は 40）

| id | notation | 名前 | 中身 |
|---|---|---|---|
| gg-236 | 236 | 236 + ボタン | 2,3,6 |
| gg-214 | 214 | 214 + ボタン | 2,1,4 |
| gg-623 | 623 | 623 + ボタン | 6,2,3 |
| gg-41236 | 41236 | 41236 + ボタン | 4,1,2,3,6 |
| gg-63214 | 63214 | 63214 + ボタン | 6,3,2,1,4 |
| gg-632146 | 632146 | 632146 + ボタン | 6,3,2,1,4,6 |
| gg-236236 | 236236 | 236236 + ボタン | 2,3,6,2,3,6 |
| gg-214214 | 214214 | 214214 + ボタン | 2,1,4,2,1,4 |
| gg-[4]6 | [4]6 | 溜め [4]6 + ボタン | [1,4,7] を 40F 溜めて 6 |
| gg-360 | 360 | 1回転 + ボタン | 1 回転 |

- `SF6_SAMPLES`: 今の SAMPLE_RECIPES と同じ
- `GG_SAMPLES`: 次の 3 つ。窓は練習用の架空の値（今のサンプルと同じく、その旨をコメントに書く）
  - `gg-sample-1`「2K から 2D、236S（サンプル）」: 2K → 2D [8, 14] → 236S [0, 10]
  - `gg-sample-2`「5P 2回から 623HS（サンプル）」: 5P → 5P [9, 13] → 623HS [0, 10]
  - `gg-sample-3`「6P から 632146HS（サンプル）」: 6P → 632146HS [4, 14]

### ゲームごとの設定（`src/core/profiles.ts`）

```ts
import type { GameId } from './games';

export type PlayableGameId = 'sf6' | 'ggst';
export interface GameProfile extends NotationRules {
  id: PlayableGameId;
  samples: readonly ComboRecipe[];
  /** 方向（up/down/left/right）とボタンのキーの初期値（KeyboardEvent.code） */
  defaultKeys: Readonly<Record<string, string>>;
  /** ボタンのパッドの初期値（標準配置のボタン番号） */
  defaultPad: Readonly<Record<string, number>>;
}
export const PROFILES: Readonly<Record<PlayableGameId, GameProfile>>;
/** 遊べるゲームの設定。mbtl・知らない id は undefined */
export function profileFor(id: unknown): GameProfile | undefined;
```

| | sf6 | ggst |
|---|---|---|
| buttons | LP MP HP LK MK HK | P K S HS D |
| buttonGroups | P: LP MP HP、K: LK MK HK | なし |
| キーの初期値 | 方向 WASD、LP U・MP I・HP O・LK J・MK K・HK L（今と同じ） | 方向 WASD、P U・K J・S I・HS K・D O |
| パッドの初期値 | LP 2・MP 3・HP 5・LK 0・MK 1・HK 7（今と同じ） | P 2・K 0・S 3・HS 1・D 5 |

GG のパッドの初期値は、PlayStation で □=P・×=K・△=S・○=HS・R1=D の並び。キーとパッドは、どちらも変えられる。

### キーの割り当て（`src/input/bindings.ts`）

```ts
export const DIRECTION_NAMES = ['up', 'down', 'left', 'right'] as const;
export type DirectionName = (typeof DIRECTION_NAMES)[number];
/** 操作の名前（方向の名前か、ボタンの名前） */
export type Action = string;

export interface Bindings {
  /** 操作 → KeyboardEvent.code。方向 4 つとゲームのボタン全部を持つ */
  keys: Record<string, string>;
  /** ボタン → パッドのボタン番号。ゲームのボタン全部を持つ */
  pad: Record<string, number>;
}

/** 方向 4 つのあとに、ゲームのボタンを並べたもの */
export function actionsFor(profile: GameProfile): string[];
export function defaultBindings(profile: GameProfile): Bindings;

/** 入れ替えの相手は keys（pad）に入っている操作の中から探す。動きは今と同じ */
export function assignKey(keys: Readonly<Record<string, string>>, action: string, code: string):
  { keys: Record<string, string>; swappedWith: string | null };
export function assignPad(pad: Readonly<Record<string, number>>, button: string, index: number):
  { pad: Record<string, number>; swappedWith: string | null };

/**
 * 保存した文字列（なければ null）から読む。例外を投げない。
 * - 壊れている・オブジェクトでない → 初期値
 * - keys はゲームの操作ごとに、空でない文字列ならそれ、そうでなければ初期値。知らない操作は捨てる
 * - pad はゲームのボタンごとに、0 以上の整数ならそれ、そうでなければ初期値。知らないボタンは捨てる
 */
export function parseBindings(raw: string | null, profile: GameProfile): Bindings;

/** localStorage のキーは 'kg-cp:bindings:<id>'。sf6 だけは、それがなければ前のキー 'kg-cp:bindings' を読む */
export function loadBindings(profile: GameProfile): Bindings;
export function saveBindings(profile: GameProfile, b: Bindings): void;
```

`BUTTON_NAMES` と `ACTIONS` はなくす（ゲームから受け取る）。

### まとめて設定（`src/input/wizard.ts`）

```ts
/** keyboard は actionsFor(profile)、pad は profile.buttons の順に聞く。ほかの動きは今と同じ */
export function startWizard(target: WizardTarget, profile: GameProfile): WizardState;
/** 方向は「上・下・左・右」、ボタンは名前そのまま */
export function actionName(action: string): string;
```

`wizardPress`・`wizardResult` の動きは今のまま（`wizardResult` は state.actions の分だけ上書きする）。

### 入力を捨てるフレームの判断（`src/input/captureFilter.ts`）

今の main.ts の `capturePending`・`taintSince` の扱いを、そのまま純粋な関数に移す。

```ts
export interface GateState {
  /** 前に見たとき、キーコンフィグが捕まえ中だった */
  capturePending: boolean;
  /** game に入った時刻。frameEnd がこれより後のフレームを 1 つ処理し終えるまで捨てる。null なら不要 */
  taintSince: number | null;
}
export const INITIAL_GATE: GateState; // { capturePending: false, taintSince: null }

/** game に入ったとき */
export function gateEnterGame(state: GateState, now: number): GateState;
/** パッドを読んだ時点で捕まえ中だったとき（そのあと同じ読み取りで捕まえが終わっても、終わったフレームを捨てるため） */
export function gateSawCapturing(state: GateState): GateState;

/**
 * 1 フレームごとに呼ぶ。block が true なら、このフレームの入力は filterInput の capturing を true にする。
 * block = capturing || (捕まえが終わったのを見つけたフレーム) || taintSince !== null || !onGameScreen
 * 捕まえが終わったのを見つけたフレーム = !capturing && state.capturePending
 * 次の capturePending = capturing
 * 次の taintSince = (!capturing && taintSince !== null && frameEnd > taintSince) ? null : taintSince
 */
export function gateFrame(
  state: GateState,
  frame: { capturing: boolean; onGameScreen: boolean; frameEnd: number },
): { block: boolean; state: GateState };
```

### 画面

- `main.ts`: いまのゲームの `GameProfile` と、そのゲームの `Bindings` を持つ。game に入るとき、前と違うゲームなら切り替える。ボタンの一覧は profile.buttons を使う
- コマンド練習（`commandPanel.ts`）: `setCommands(commands)` で一覧を入れ替え、先頭を選ぶ
- コンボトライアル（`comboPanel.ts`）: `setProfile(profile)` で、サンプル・表記のルール・保存したレシピを入れ替え、先頭のレシピを選び、回数を 0 にする。保存のキーは `'kgcp.comboRecipes.<id>'`。sf6 だけは、それがなければ前のキー `'kgcp.comboRecipes'` を読む
- キーコンフィグ（`keyconfig.ts`）: `setProfile(profile, bindings)` で、一覧・図・まとめて設定を、そのゲームのボタンに切り替える。捕まえ中なら取り消す。保存は `saveBindings(profile, …)`
- キーボードとパッドの図: 割り当てた操作の名前を出す（今と同じ。名前がゲームのボタンになる）
- ゲーム名の下の注記「ボタンとコマンドは、まだスト6 の形です」は消す。GG では「猶予は共通の値です」と出す
- ゲームを切り替えても、ページの再読み込みはしない。window に足したイベントの受け手を増やさない（作り直すのではなく、入れ替える）

## 受け入れ条件

1. `parseStep`
   - スト6 のルールで、今の notation のテストがすべて同じ結果になる（2LP・5MP・236HP・236P・[4]6P・[2]8K・読めないもの）
   - スト6 で 236K（P の技に K のまとめ書き）・236LK は読めない
   - GG のルールで 2K・6P・2D は通常技（2 は [1,2,3]）。236S・236HS・632146HS・[4]6D・360P はコマンド
   - GG で 236HS のボタンは ['HS']（'S' と読み違えない）
   - GG で 236LP・2LP・236（ボタンなし）は読めない
2. コマンドとサンプル
   - SF6_COMMANDS は今の 8 個と同じ id・中身で、notation が上のとおり
   - GG_COMMANDS が上の表のとおり（id・notation・中身・ボタン）。GG で、それぞれのモーションを素直に入れてボタンを押すと成立する（analyzeAttempt が ok）
   - GG_SAMPLES の 3 つが GG のルールで読め、上のとおりの手と窓になる。SF6_SAMPLES は今と同じ
3. `profileFor`・`PROFILES`
   - sf6・ggst は上の表のとおり。mbtl・'xx'・数値は undefined
   - どちらのゲームも、defaultKeys は actionsFor の全部の操作を持ち、キーが重ならない。defaultPad はボタン全部を持ち、番号が重ならない
4. `actionsFor`・`defaultBindings`・`assignKey`・`assignPad`・`parseBindings`
   - 今の bindings のテストの入れ替えの動きが、スト6 でも GG でも同じに働く
   - `parseBindings`: null・壊れた JSON・配列 → 初期値。一部の操作だけおかしい・ない → その操作だけ初期値。知らない操作（GG に LP など）は捨てる
5. `startWizard`・`actionName`
   - GG のキーボードは 上・下・左・右・P・K・S・HS・D の順、パッドは P・K・S・HS・D の順
   - 今の wizard のテストの動き（重なりの拒否・Esc・十字キーの拒否・結果）が、GG でも同じに働く
6. `gateFrame` ほか
   - 捕まえ中のフレームは block。捕まえが終わったのを見つけたフレームは block、その次のフレームは block しない
   - game に入った時刻 t のあと、frameEnd ≤ t のフレームは block のまま、frameEnd > t のフレームを 1 つ処理したら、その次から block しない
   - 例: rAF が 0・16.67・33.33ms、フレームの終わりがその 2ms 手前（14.67・31.33）。1ms に捕まえが終わったら、14.67 のフレームだけ block、31.33 のフレームは block しない
   - game の画面でなければ、いつも block
   - `gateSawCapturing` のあと、捕まえ中でないフレームは block（終わったのを見つけたフレーム扱い）
7. 画面（手で確かめる。`docs/manual-checks.md` に「9. ゲームごとのボタンとコマンド」として足す）
   - GG を選ぶと、コマンド一覧・サンプル・キーコンフィグの一覧と図・入力履歴のボタン名が GG のものになる
   - GG のキーの割り当てを変えても、スト6 の割り当ては変わらない（逆も）。再読み込みしても、それぞれ残る
   - 前の版で変えたスト6 の割り当てと読み込んだレシピが、そのまま残っている
   - スト6 と GG を何度か行き来しても、キーが二重に効いたり、キーコンフィグの捕まえが残ったりしない
   - GG で 236HS・632146HS が成立し、サンプルのトライアルが完走できる

## やらないこと

- 猶予の数値（3 段目）
- GG のキャラごとの技・空中の表記（j.）・特殊なボタン（ロマンキャンセルなど）
- メルブラ
