# 第2段階: コンボトライアル

## 目的

「2LP > 2LP > 236HP」のようなレシピに沿って、各手を **前の手から決められたフレームの窓のあいだ** に入力できたかを判定する。
キャラや当たり判定はないので、判定は入力のタイミングだけで行う。窓の数値はレシピに書く（フレームデータからの自動計算は後の段階）。

第1段階の `analyzeAttempt` と `DEFAULT_COMMANDS` をそのまま使う。

## 構成

```
src/core/notation.ts   parseStep（表記 → 入力の条件）
src/core/combo.ts      parseRecipe, initialTrialState, stepTrial
src/core/samples.ts    SAMPLE_RECIPES（内蔵サンプル）
src/ui/comboPanel.ts   コンボトライアル画面
tests/notation.test.ts, tests/combo.test.ts
```

## テストのコマンド

- `npm test`・`npm run typecheck`・`npm run build` がすべて終了コード 0

## 外から見える形（API）

### 表記（`src/core/notation.ts`）

```ts
export type StepInput =
  | { kind: 'normal'; dirs: readonly Direction[]; buttons: readonly string[] }
  | { kind: 'command'; command: CommandDef; buttons: readonly string[] };

export function parseStep(
  text: string,
  commands: readonly CommandDef[],
): { ok: true; input: StepInput } | { ok: false; error: string };
```

表記は `<方向や動き><ボタン>`。前後の空白は無視する。

- **ボタン部分**: 末尾の `LP` `MP` `HP` `LK` `MK` `HK` のどれか、または `P`（LP/MP/HP のどれでも）・`K`（LK/MK/HK のどれでも）
- **方向が1文字（1〜9）なら通常技**（`kind: 'normal'`）
  - `2` は `[1, 2, 3]`（しゃがみ技。斜め下でもよい）
  - それ以外の数字は、その方向だけ（例: `5` → `[5]`、`6` → `[6]`）
  - 例: `2LP` → `{ kind:'normal', dirs:[1,2,3], buttons:['LP'] }`、`5MP` → `{ dirs:[5], buttons:['MP'] }`
- **それ以外は必殺技**（`kind: 'command'`）。`commands` の中から、id の末尾の `P` か `K` を取った部分（例: `236P` → `236`、`[4]6P` → `[4]6`）が方向部分と一致し、かつボタンの種類（P 系か K 系か）が同じものを探す
  - `buttons` は、表記のボタンが `P` / `K` ならそのコマンドの `buttons` のまま。`HP` のように1つなら `['HP']`
  - 例: `236HP` → `{ kind:'command', command:<236P の定義>, buttons:['HP'] }`、`[4]6P` → `<[4]6P の定義>, buttons:['LP','MP','HP']`
- 当てはまらなければ `{ ok:false, error }`。`error` は日本語で、どの表記が読めなかったかを含める

### 入力の成立（`src/core/combo.ts`）

```ts
/** いまのフレーム（history の最後）で step の入力が成立したか */
export function matchesStep(history: readonly FrameInput[], input: StepInput): boolean;
```

- normal: いまのフレームで `input.buttons` のどれかが **押された瞬間**（第1段階と同じ定義）で、かつ、いまの方向が `input.dirs` に入っている
- command: `analyzeAttempt(history, { ...input.command, buttons: input.buttons })` が `ok: true`

### レシピ（`src/core/combo.ts`）

```ts
export interface ComboStep {
  text: string;                    // 元の表記 例: '2LP'
  input: StepInput;
  window: { min: number; max: number } | null; // 最初の手は null
}
export interface ComboRecipe { id: string; name: string; steps: readonly ComboStep[]; }

export function parseRecipe(
  json: unknown,
  commands: readonly CommandDef[],
): { ok: true; recipe: ComboRecipe } | { ok: false; error: string };
```

JSON の形:

```json
{
  "id": "sample-1",
  "name": "小足2回から波動",
  "steps": [
    { "input": "2LP" },
    { "input": "2LP", "window": [10, 14] },
    { "input": "236HP", "window": [0, 10] }
  ]
}
```

- `id`・`name` は空でない文字列、`steps` は1個以上
- 最初の手の `window` は無視する（`null` にする）。2手目以降は `window` が必須で、`[min, max]` は 0 以上の整数かつ `min <= max`
- どれかが守られていなければ `{ ok:false, error }`（日本語。何手目のどこが悪いかを含める）
- `json` は `JSON.parse` 済みの値を受け取る（文字列の解析は画面側）

### トライアルの進行（`src/core/combo.ts`）

```ts
export interface TrialState {
  stepIndex: number;          // 次に入力すべき手
  lastPressFrame: number | null; // 直前の手が成立したフレーム（history の添字ではなく、通算フレーム番号）
}
export type TrialEvent =
  | { type: 'hit'; stepIndex: number; offset: number | null } // offset は前の手からのフレーム数。最初の手は null
  | { type: 'complete'; stepIndex: number; offset: number | null } // 最後の手が成立
  | { type: 'drop'; stepIndex: number; reason: 'early' | 'late' | 'wrong'; offset: number };

export function initialTrialState(): TrialState;

/**
 * 1フレーム進める。frame はいまの通算フレーム番号（毎フレーム1ずつ増える）。
 * history の最後の要素がいまのフレーム。
 */
export function stepTrial(
  state: TrialState,
  recipe: ComboRecipe,
  history: readonly FrameInput[],
  frame: number,
): { state: TrialState; event: TrialEvent | null };
```

進め方（`step = recipe.steps[state.stepIndex]`）:

1. **最初の手を待っているとき**（`stepIndex === 0`）: `matchesStep` が成立したら、`hit`（手が1つだけのレシピなら `complete`）。`lastPressFrame = frame`、`stepIndex = 1`。成立しなければ何もしない（ほかのボタンを押しても失敗にしない）
2. **2手目以降**: `offset = frame - lastPressFrame`
   - `matchesStep` が成立: `offset < min` なら `drop`（`early`）、そうでなければ `hit`（最後の手なら `complete`）。`offset > max` で成立することは、次のルールで先に落ちるので起きない
   - 成立しないが、いまのフレームで **どれかのボタンが押された瞬間**: `drop`（`wrong`）。今の手と同じボタンでも、方向やモーションが合っていなければ別の技が出る場面なので落とす（例: 2LP の手で 5LP、236HP の手でモーションが足りないまま HP）
   - 成立せず、`offset > max`: `drop`（`late`）
3. `drop` か `complete` のあとは `initialTrialState()` に戻る。戻ったフレームでは最初の手の判定をしない（次のフレームから）

### サンプル（`src/core/samples.ts`）

`SAMPLE_RECIPES: ComboRecipe[]` に3つ程度。窓の数値は **練習用の架空の値** で、特定のゲームの数値ではない。名前に「（サンプル）」を付ける。`parseRecipe` を通して作り、読めなかったら起動時に例外で気づけるようにする。

## 画面の動き

- 画面上部にタブ: 「コマンド練習」「コンボトライアル」。入力履歴とキーコンフィグは両方のタブで共通
- コンボトライアル:
  - レシピの一覧（サンプル＋読み込んだもの）から1つ選ぶ
  - 手の列を横に並べて表示し、次に入力すべき手を強調する。各手の下に窓（例: `10〜14F`）
  - `hit`: その手を緑にして `+12F` のように offset を出す
  - `drop`: その手を赤にして理由を表示（早い: 「早い（あと ◯F 遅く）」＝ `min - offset`、遅い: 「遅い（窓は ◯〜◯F）」、違う: 「違う入力」）
  - `complete`: 「完走！」と表示
  - 挑戦回数と完走回数、完走率を表示
  - 「JSON を読み込む」: テキスト欄に貼って読み込む。エラーは `parseRecipe` の `error` を表示。読み込んだレシピは `localStorage` に保存（try/catch で囲む）
  - 「JSON に書き出す」: 選んだレシピを JSON 文字列にしてテキスト欄に出す（`input` は元の表記 `text` で書き出す）

## 受け入れ条件

1. `parseStep` が通常技・必殺技（ボタン1つ／P・K のまとめ指定）・溜め・360 を表記どおりに読み、読めない表記で `ok:false` を返す
2. `matchesStep` が normal（押した瞬間＋方向）と command（analyzeAttempt）の両方で正しく判定する
3. `parseRecipe` が正しい JSON を読み、形の誤り（id・name・steps・window）を日本語のエラーで返す
4. `stepTrial` が上の進め方どおりに `hit` / `complete` / `drop`（early・late・wrong）を返し、窓の境界（ちょうど min・max は成功、1 外は失敗）を守る
5. drop・complete のあとは最初の手から、次のフレームでやり直せる
6. `SAMPLE_RECIPES` がすべて `parseRecipe` を通る
7. `npm test`・`npm run typecheck`・`npm run build` がすべて終了コード 0
8. ブラウザでサンプルを選び、キーボードで完走・各種の失敗が表示される（開発者が手で確認）

## この段階でやらないこと

- フレームデータからの窓の自動計算、レシピの編集フォーム、ゲーム別の数値、2P 側の反転、録画と再生
