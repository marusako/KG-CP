# 第4段階: 見て分かるキーコンフィグ

## 目的

いまのキーコンフィグは「KeyU」「パッド 2」のような文字の一覧で、何を設定しているか・いま何を入力しているかが分かりにくい。次のようにする。

- **操作中のデバイスを表示する**（キーボード／パッドの名前と種類）。設定画面もそのデバイスに合わせて切り替わる
- **図で見せる**: パッドやキーボードの絵の上に、割り当てた操作（LP など）を書き、押しているボタン・キーを光らせる
- **割り当て方は2つ**: 「順番に聞いて一括で設定」と「操作をクリックして個別に直す」
- **パッドのボタン名を自動で切り替える**: Xbox 式（A/B/X/Y）か PlayStation 式（×/○/□/△）。分からなければ番号

アケコン・レバーレスの配置図は後の段階で足す（図の仕組みは、配置のデータを足せば増やせる形にしておく）。

## 調べたこと（根拠）

`Gamepad.id` の形式は仕様で決まっておらず、ブラウザで違う（MDN の Gamepad.id の説明、W3C の議論での例による）。

- Chrome: `DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)`、`Xbox 360 Controller (XInput STANDARD GAMEPAD)`
- Firefox: `54c-ce6-DualSense Wireless Controller`（ベンダー ID・プロダクト ID・名前をハイフンでつなぐ。先頭の 0 は省かれる）
- ベンダー ID: Sony = `054c`、Microsoft = `045e`

ボタンの番号は、`Gamepad.mapping === 'standard'` のときだけ「標準の配置」（W3C Gamepad 仕様の Standard Gamepad）に従う。それ以外は番号の意味が決まっていない。

## 構成

```
src/input/padLayout.ts     detectPadFamily, padButtonLabel
src/input/keyLabel.ts      keyLabel
src/input/activeDevice.ts  nextActiveDevice
src/input/wizard.ts        startWizard, wizardPress, wizardResult
src/ui/diagrams.ts         パッドとキーボードの図（SVG）
src/ui/keyconfig.ts        作り直す
tests/padLayout.test.ts, tests/keyLabel.test.ts, tests/activeDevice.test.ts, tests/wizard.test.ts
```

## テストのコマンド

- `npm test`・`npm run typecheck`・`npm run build` がすべて終了コード 0

## 外から見える形（API）

### パッドの種類とボタン名（`src/input/padLayout.ts`）

```ts
export type PadFamily = 'xbox' | 'playstation' | 'unknown';

export function detectPadFamily(id: string, mapping: string): PadFamily;
export function padButtonLabel(family: PadFamily, index: number): string;
```

`detectPadFamily`:
- `mapping !== 'standard'` なら `'unknown'`
- 大文字小文字を区別せずに調べる
- PlayStation: `Vendor: 054c` を含む／先頭が `54c-` か `054c-`／`dualsense`・`dualshock`・`playstation` を含む
- Xbox: `Vendor: 045e` を含む／先頭が `45e-` か `045e-`／`xbox`・`xinput` を含む
- 両方に当てはまるときは PlayStation を優先し、どちらにも当てはまらなければ `'unknown'`

`padButtonLabel`（標準の配置の番号）:

| 番号 | xbox | playstation |
|---|---|---|
| 0 | A | × |
| 1 | B | ○ |
| 2 | X | □ |
| 3 | Y | △ |
| 4 | LB | L1 |
| 5 | RB | R1 |
| 6 | LT | L2 |
| 7 | RT | R2 |
| 8 | View | Create |
| 9 | Menu | Options |
| 10 | LS | L3 |
| 11 | RS | R3 |
| 12〜15 | ↑ ↓ ← → | ↑ ↓ ← → |
| 16 | Xbox | PS |
| 17 | （表にない） | タッチパッド |

- 表にない番号と、`'unknown'` のときは `ボタン ${index}`

### キーの表示名（`src/input/keyLabel.ts`）

```ts
export function keyLabel(code: string): string;
```

- `KeyA`〜`KeyZ` → `A`〜`Z`、`Digit0`〜`Digit9` → `0`〜`9`、`Numpad0`〜`Numpad9` → `テンキー0`〜`テンキー9`
- `ArrowUp` `ArrowDown` `ArrowLeft` `ArrowRight` → `↑` `↓` `←` `→`
- `Space` → `Space`、`ShiftLeft` → `左Shift`、`ShiftRight` → `右Shift`、`ControlLeft` → `左Ctrl`、`ControlRight` → `右Ctrl`、`Enter` → `Enter`
- それ以外は `code` のまま

### 操作中のデバイス（`src/input/activeDevice.ts`）

```ts
export type Device =
  | { kind: 'keyboard' }
  | { kind: 'pad'; index: number; id: string; family: PadFamily };

/**
 * pressed はこのフレームで「何かが新しく押された」デバイスの一覧
 * （キーボードは何かのキーが押された瞬間、パッドはボタンが押された瞬間か、スティック・十字キーの方向が入った瞬間）
 */
export function nextActiveDevice(current: Device, pressed: readonly Device[]): Device;
```

- `pressed` が空なら `current` のまま
- `current` が `pressed` に含まれていれば `current` のまま（同じフレームで別のデバイスも押されたときに、表示が揺れないようにするため）。同じかどうかは、キーボードどうし、またはパッドの `index` が同じかで決める
- 含まれていなければ `pressed[0]`
- 最初の値は `{ kind: 'keyboard' }`（main.ts が持つ）

### 一括設定（`src/input/wizard.ts`）

```ts
export type WizardTarget = 'keyboard' | 'pad';
export interface WizardState {
  readonly target: WizardTarget;
  readonly actions: readonly Action[];   // keyboard: ACTIONS（方向4つ＋ボタン6つ）、pad: BUTTON_NAMES（6つ。方向は十字キーとスティックで固定）
  readonly index: number;                // 次に聞く操作の番号
  readonly picked: readonly (string | number)[]; // これまでに選ばれた入力（keyboard はコード、pad はボタン番号）
  readonly error: string | null;         // 直前の入力を受け付けなかった理由（日本語）
  readonly done: boolean;
}

export function startWizard(target: WizardTarget): WizardState;
export function wizardPress(state: WizardState, input: string | number): WizardState;
/** done のときだけ使う。picked を current の割り当てに上書きした新しい Bindings を返す（current は書き換えない） */
export function wizardResult(state: WizardState, current: Bindings): Bindings;
```

`wizardPress` のルール:
- `done` なら何もしない（同じ state を返す）
- `target` に合わない種類の入力（keyboard に数値、pad に文字列）は何もしない
- この一括設定の中で、もう前の操作に選んだ入力なら受け付けず、`error` に「すでに ◯◯ に使っています」（◯◯ は操作の表示名）
- pad で 12〜15（十字キー）は受け付けず、`error` に「十字キーは方向に使うので、ボタンには割り当てられません」
- keyboard で `Escape` は受け付けない（画面側が取り消しに使う）。`error` に「Esc は取り消しに使うので割り当てられません」
- 受け付けたら `picked` に足し、`index` を1つ進め、`error` を `null` にする。最後の操作まで終わったら `done: true`

操作の表示名: up=上、down=下、left=左、right=右、ボタンは `LP` などそのまま。

## 画面の動き

### 操作中のデバイス
- キーコンフィグの上部に「操作中: キーボード」または「操作中: DualSense Wireless Controller（PlayStation 式）」と出す（パッドの名前は `id` から括弧やベンダー番号を除いた読みやすい部分。うまく取れなければ `id` のまま）
- 図は、操作中のデバイスの図に自動で切り替わる。「キーボード」「パッド」のタブで手動でも切り替えられ、手動で選んでいる間は自動で切り替えない（「自動」に戻すボタンを置く）

### 図
- **パッドの図**: 標準の配置のパッドを SVG で描く。4つの面のボタン、LB/RB/LT/RT、十字キー、左右のスティック、View/Menu
  - 各ボタンにボタン名（`padButtonLabel`）を書き、割り当てた操作（例: `LP`）を色付きで重ねる
  - 押しているボタンを光らせる。左スティックは倒している向きに点を動かす
- **キーボードの図**: 数字の段から下の段までの 4 段（QWERTY 配列）と矢印キーを描く
  - 割り当てたキーに操作名を重ね、押しているキーを光らせる
  - 図にないキーに割り当てている場合は、図の下に「図にないキー: テンキー5 = LP」と書く
- 図の横に「いまの入力」: 方向（矢印）と押しているボタン（例: `↘ + LP`）

### 割り当て
- 「まとめて設定」ボタン: そのデバイスの一括設定を始める
  - 図の上に「LP に使うボタンを押してください（3/6）」と出し、聞いている操作を強調する
  - `error` があれば赤で出す
  - Esc か「取り消し」ボタンで、何も変えずに終わる
  - 終わったら `wizardResult` で割り当てを置き換えて保存し、「設定しました」と出す
- 個別に直す: 図の横の操作の一覧（上・下・…・HK）をクリックすると、その操作の入力待ちになる。キーかボタンを押すと、これまでどおり `assignKey` / `assignPad` で割り当てる（重なったら入れ替えて知らせる）。pad で十字キーを押したら受け付けずに知らせる
- 一括設定中・入力待ちの間は、その入力をゲームの入力としては使わない（コマンド練習やトライアルが進まないようにする）
- クリックしたボタンは、これまでどおりフォーカスを外す

## 受け入れ条件

1. `detectPadFamily` が Chrome 形式・Firefox 形式・名前の言葉で Xbox／PlayStation を見分け、`mapping` が `'standard'` でなければ `'unknown'` を返す
2. `padButtonLabel` が表どおりの名前を返し、表にない番号や `'unknown'` では `ボタン ${index}` を返す
3. `keyLabel` が上の変換どおりに返す
4. `nextActiveDevice` が上のルールどおりに切り替える（今のデバイスが含まれていれば変えない）
5. `wizardPress`・`wizardResult` が上のルールどおりに動き、`current` を書き換えない
6. 既存のテストがすべて通ったまま、`npm test`・`npm run typecheck`・`npm run build` が終了コード 0
7. ブラウザで、キーボードとパッドを交互に触ると「操作中」と図が切り替わり、押したところが光り、一括設定と個別の直しができる（開発者が手で確認）

## 変更 1（レビューの提案への対応）

### テストを付ける純粋な関数

#### 離すまで無視する仕組み（`src/input/captureFilter.ts`）

main.ts の中にある「設定中・設定直後に押していた入力は、離すまでゲーム入力に使わない」処理を、純粋な関数に切り出す。

```ts
export type PadDir = 'up' | 'down' | 'left' | 'right';
export interface RawInput {
  keys: ReadonlySet<string>;        // このフレームで押されていたキーのコード（KeyTimeline の sample の結果）
  freshKeys: ReadonlySet<string>;   // このフレームで「押されていない状態から」押されたキーのコード
  padButtons: ReadonlySet<number>;  // 押しているパッドのボタン番号
  padDirs: ReadonlySet<PadDir>;     // パッドで入っている方向（十字キー・スティック）
}
export interface IgnoreSet {
  keys: ReadonlySet<string>;
  padButtons: ReadonlySet<number>;
  padDirs: ReadonlySet<PadDir>;
}
export function emptyIgnore(): IgnoreSet;

/**
 * capturing は「捕まえ中、またはこのフレームで捕まえが終わった」。
 * 返す input は、ゲームに使ってよい入力（freshKeys は使わないので空でよい）
 */
export function filterInput(raw: RawInput, ignore: IgnoreSet, capturing: boolean): { input: Omit<RawInput, 'freshKeys'>; ignore: IgnoreSet };
```

- `capturing` が true: 新しい ignore = 今の ignore ∪ raw の全部（keys・padButtons・padDirs それぞれ）。input はすべて空
- `capturing` が false:
  - 新しい ignore = （今の ignore ∩ raw）。ただし keys は、さらに `freshKeys` に入っているものを除く（1 フレームのうちに離して押し直したキーは、新しい押下として使えるようにする）
  - input = raw − 新しい ignore（それぞれ）
- 引数は書き換えない

KeyTimeline に `sampleDetailed(frameEnd): { pressed: ReadonlySet<string>; fresh: ReadonlySet<string> }` を足す。`pressed` は今の `sample` の結果と同じ。`fresh` は、取り出したイベントのうち、押されていない状態からの down だったコード。`sample` は `sampleDetailed(...).pressed` を返す（今の動きは変えない）。

main.ts の `heldCodes`（keydown/keyup を別に数えていた集合）は、この仕組みに置き換えて片付ける。

#### 抜いたパッド（`src/input/activeDevice.ts` に追加）

```ts
/** current がパッドで、その index が connected に含まれなければ { kind: 'keyboard' }。それ以外は current のまま（同じ参照） */
export function dropDisconnected(current: Device, connected: readonly number[]): Device;
```

#### パッド名の取り出し（`padDisplayName`、テストを足す）

- Chrome 形式は、最初の ` (` より前: `DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)` → `DualSense Wireless Controller`、`Xbox 360 Controller (XInput STANDARD GAMEPAD)` → `Xbox 360 Controller`
- Firefox 形式は、先頭の「16 進-16 進-」より後: `54c-ce6-DualSense Wireless Controller` → `DualSense Wireless Controller`
- 取り出した結果が空なら id のまま（例: `(STANDARD GAMEPAD)` → `(STANDARD GAMEPAD)`）

### 画面とつなぎ込みの直し（テストなし、本体がブラウザで確かめる）

- キーボードの図の文字を大きくする（実際の表示で 12px 以上になるようにする）
- キーコンフィグのパネルの幅を固定し、図を切り替えても配置が変わらないようにする。操作の一覧は、幅が足りれば図の横に置く
- まとめて設定の途中は、図のキーの強調をやめ、一覧で聞いている操作だけを強調する
- 「いまの入力」に、どのデバイスの入力かを書き添える（例: `いまの入力（パッド）: ↘ + LP`）
- まとめて設定・個別の入力待ちのあいだ、キーリピート（`e.repeat`）は捕まえに渡さない（`preventDefault` だけする）
- 初めて見えたパッドは、前回を「何も押していない」とみなして、最初の1回の押下で操作中のデバイスを切り替える
- パッドを抜いたら `dropDisconnected` で操作中のデバイスをキーボードに戻す
- パッドの図の配置を `{ cells, viewBox, stick }` のような1つのデータにまとめ、アケコンの配置を足すときに差し替えやすくする
- 使われていない `keyActionOf` を消す。方向の名前の配列は1か所にまとめ、`as` のキャストが要らない型にする

### 受け入れ条件（追加）

8. `filterInput` が上のルールどおりに動く（捕まえ中は全部無視して集合に足す／離したら外れる／押し続けている間は無視が続く／1 フレーム内の押し直しは使える／パッドで捕まえが終わったフレームも漏れない／引数を書き換えない）
9. `KeyTimeline.sampleDetailed` の `fresh` が「押されていない状態からの down」だけを含み、既存の `sample` の動きが変わらない
10. `dropDisconnected` と `padDisplayName` が上のとおりに動く
11. 既存のテストがすべて通ったまま、`npm test`・`npm run typecheck`・`npm run build` が終了コード 0

## この段階でやらないこと

- アケコン・レバーレスの配置図、2台以上のパッドを同時に別々に設定すること、ボタン配置のプリセット
