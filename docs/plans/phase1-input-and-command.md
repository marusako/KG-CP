# 第1段階: 入力表示とコマンド判定

## 目的

格ゲー（スト6・ギルティギア・メルティブラッドなど）のコマンド入力を練習する Web アプリの第1段階。
キーボードとゲームパッドの入力を 60fps で読み、入力履歴を表示し、コマンド（236P など）が成立したか・何フレームかかったか・どこがズレたかを表示する。
コンボトライアルは第2段階で、この判定の上に載せる。

## 技術と構成

- TypeScript + Vite。テストは Vitest
- 判定ロジック（`src/core/`）はブラウザ API に依存しない純粋な関数にする。将来 Tauri でデスクトップ化するときもそのまま使う
- 入力層（`src/input/`）はキーボード・Gamepad API を読み、1フレームごとの `FrameInput` に変換する
- 画面（`src/ui/`, `src/main.ts`）は DOM で描く（フレームワークは使わない）

```
src/
  core/types.ts       型定義
  core/detect.ts      analyzeAttempt（コマンド判定）
  core/history.ts     compressHistory（入力履歴の圧縮）
  core/commands.ts    標準コマンド定義 DEFAULT_COMMANDS
  input/direction.ts  resolveDirection, stickToPressed
  input/keyboard.ts   キーボード読み取り（テスト対象外）
  input/gamepad.ts    Gamepad API 読み取り（テスト対象外）
  ui/...              画面
  main.ts             60fps ループ
tests/                Vitest のテスト（*.test.ts）
```

## テストのコマンド

- `npm test`（= `vitest run`）が終了コード 0
- `npm run typecheck`（= `tsc --noEmit`）が終了コード 0
- `npm run build`（= `vite build`）が終了コード 0

## 外から見える形（API）

### 型（`src/core/types.ts`）

```ts
/** テンキー表記。5 がニュートラル。1P 側（右向き）基準。 */
export type Direction = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/** 1フレーム分の入力。buttons はそのフレームに「押されている」ボタン名。 */
export interface FrameInput {
  dir: Direction;
  buttons: readonly string[];
}

/** モーションの1手。dirs のどれかに入っていれば、その手を満たす。 */
export interface MotionStep {
  dirs: readonly Direction[];
  /** 溜め用。指定時は、この手の方向を「連続で」このフレーム数以上押している必要がある */
  minHold?: number;
}

export type CommandDef =
  | {
      kind: 'motion';
      id: string;          // 例: '236P'
      name: string;        // 表示名 例: '波動 (236P)'
      steps: readonly MotionStep[];
      buttons: readonly string[]; // どれか1つの押下で成立 例: ['LP','MP','HP']
      motionWindow: number; // 最初の手から最後の手までの最大フレーム数
      buttonWindow: number; // 最後の手からボタン押下までの最大フレーム数
    }
  | {
      kind: 'rotation';    // 1回転（360）
      id: string;
      name: string;
      buttons: readonly string[];
      motionWindow: number; // ボタン押下フレームから何フレーム前まで見るか
    };

export type AttemptResult =
  | { ok: true; motionFrames: number; buttonDelay: number }
  | { ok: false; reason: 'incomplete'; matchedSteps: number; expected: readonly Direction[] }
  | { ok: false; reason: 'too-slow'; motionFrames: number }
  | { ok: false; reason: 'button-late'; buttonDelay: number }
  | { ok: false; reason: 'charge-short'; heldFrames: number }
  | { ok: false; reason: 'rotation-incomplete'; missing: readonly ('left' | 'down' | 'right' | 'up')[] };
```

### `analyzeAttempt(history, def): AttemptResult | null`（`src/core/detect.ts`）

- `history` は古い順の `FrameInput[]`。**最後の要素が「いまのフレーム」**
- いまのフレームで `def.buttons` のどれかが **押された瞬間**（そのフレームで押されていて、1つ前のフレームでは押されていない。1つ前がなければ押された扱い）でなければ `null`
- 押された瞬間なら、以下のルールで判定した結果を返す

#### motion の判定ルール

フレーム番号は `history` の添字。押下フレームを `B` とする。

1. **後ろから貪欲に探す**: 最後の手は「`B` 以下で、方向がその手の `dirs` に入る最も新しいフレーム」。その前の手は「次の手のフレームより前で、`dirs` に入る最も新しいフレーム」…と最初の手までさかのぼる。手と手のあいだに別の方向が挟まってもよい（時間で制限する）
2. 手が全部見つからなければ `{ ok:false, reason:'incomplete', matchedSteps, expected }`。この2つは練習者に分かりやすいよう、**前向き探索** で決める:
   - 範囲は `max(0, B - (motionWindow + buttonWindow))` 〜 `B`
   - 先頭の手から順に「前の手のフレームより後で、最初に `dirs` に入るフレーム」を探す（最初の手は範囲の先頭から探す）
   - `matchedSteps` = 前向き探索で揃った手の数、`expected` = その次の手の `dirs`
3. 全手見つかったら、`firstFrame` = 最初の手のフレーム、`lastFrame` = 最後の手のフレームとして
   - `motionFrames = lastFrame - firstFrame`
   - `buttonDelay = B - lastFrame`
4. 溜め（`minHold`）: 手のフレーム `f` から前に向かって、方向がその手の `dirs` に入り続けるフレーム数（`f` を含む）を `heldFrames` とする。`heldFrames < minHold` なら `{ ok:false, reason:'charge-short', heldFrames }`。溜めの手のあいだの時間は `motionFrames` に含めない（溜めの手が最初の手なら `firstFrame = f` のまま。つまり溜め終わりから数える）
5. 判定の優先順: incomplete → charge-short → too-slow（`motionFrames > motionWindow`）→ button-late（`buttonDelay > buttonWindow`）→ ok

#### rotation の判定ルール

- 範囲: `max(0, B - motionWindow)` 〜 `B`
- 4つのグループ left `{1,4,7}`・down `{1,2,3}`・right `{3,6,9}`・up `{7,8,9}` のそれぞれについて、範囲内に1フレームでも入っていれば満たす（斜めは両方のグループに数える。順番は問わない）
- 全部満たせば `{ ok:true, motionFrames: B - (範囲内で最初にどれかのグループに入ったフレーム), buttonDelay: 0 }`
- 足りなければ `{ ok:false, reason:'rotation-incomplete', missing }`（`missing` は left, down, right, up の順）

### `compressHistory(history, maxEntries): HistoryEntry[]`（`src/core/history.ts`）

```ts
export interface HistoryEntry {
  dir: Direction;
  buttons: readonly string[]; // 押されているボタン（順番はそのフレームの buttons のまま）
  pressed: readonly string[]; // この区間の先頭フレームで「押された瞬間」だったボタン
  frames: number;             // 同じ状態が続いたフレーム数
}
```

- 方向と押されているボタンの集合（順番は無視）が同じ連続フレームを1つにまとめる
- **新しい順**に返す。`maxEntries` 件まで

### `DEFAULT_COMMANDS: CommandDef[]`（`src/core/commands.ts`）

236P, 214P, 623P, 41236P, 63214P, [4]6P（溜め）, [2]8K（溜め）, 360P を含む。猶予の数値は「共通ルールの仮の値」で、ゲーム別の正確な値は後の段階でプリセットとして調べて入れる。ボタン名は `LP MP HP LK MK HK` の6つ。

### 入力層（`src/input/direction.ts`）

```ts
export interface PressedDirs { up: boolean; down: boolean; left: boolean; right: boolean; }
export type SocdUpDown = 'up' | 'neutral';

/** 押されている上下左右からテンキー方向を決める。左右同時押しは常に左右ニュートラル。上下同時押しは socd に従う */
export function resolveDirection(p: PressedDirs, socd: SocdUpDown): Direction;

/** スティックの値（-1〜1、y は下が正）を上下左右に変換。|値| が deadzone 以下は押していない扱い */
export function stickToPressed(x: number, y: number, deadzone: number): PressedDirs;
```

## 画面の動き

- 60fps の固定ループ（`requestAnimationFrame` ＋ 経過時間の積算で 1/60 秒ごとに1フレーム進める）で入力を読む
- キーボードとパッドの入力は OR で合成する（どちらで押しても効く）
- デフォルトのキー: 方向 WASD、ボタン U I O（LP MP HP）／ J K L（LK MK HK）。パッドは十字キーと左スティック、ボタンは標準配置に割り当て
- 左側: 入力履歴（新しい順、方向は矢印、ボタン、フレーム数）を最大 20 件
- 右側: 「練習するコマンド」を選ぶ一覧。選んだコマンドに対して、ボタンを押すたびに `analyzeAttempt` の結果を表示（成立: 緑で motionFrames と buttonDelay。失敗: 赤で理由を日本語で）。直近の成功率も表示
- キーコンフィグ画面: ボタンをクリック → キーかパッドのボタンを押すと割り当てが変わる。`localStorage` に保存（読み書きは try/catch で囲み、使えなくても動く）

## 受け入れ条件

1. `analyzeAttempt` が上のルールどおりに判定する（成立、手が足りない、遅すぎる、ボタンが遅い、溜め不足、1回転不足、押した瞬間でないと null）
2. 手のあいだに別の方向が挟まっても、時間内なら成立する（例: 2→1→3→6 で 236 成立）
3. ボタンを押しっぱなしのフレームでは `null`（押した瞬間だけ判定）
4. `compressHistory` が同じ状態をまとめ、新しい順に `maxEntries` 件返す
5. `resolveDirection` が 9 方向と SOCD（左右同時押し=ニュートラル、上下同時押しは設定どおり）を正しく返す
6. `stickToPressed` が deadzone を守る
7. `npm test`・`npm run typecheck`・`npm run build` がすべて終了コード 0
8. ブラウザで開くと、キーボード入力で履歴が流れ、選んだコマンドの判定が表示される（本体が手で確認）

## 変更 1（レビュー後の見直し）

### A. 最後の手を「入った瞬間」で数える

理由: これまでは、236 の 6 を押し続けてから P を押すと、6 を押していた時間まで `motionFrames` に入っていた。そのため、モーション自体は速くても `too-slow` と出ていた。押し続けた時間は「ボタンが遅い」の側に数えるほうが、練習する人にとって実態に合う。

motion の判定ルール 1・3 を次のように変える（ほかのルールは変えない）。

- 後ろから貪欲に探して最後の手のフレーム `f` を見つけたら、そこから前に向かって、方向が最後の手の `dirs` に入り続ける区間をさかのぼる。その **区間の先頭** を `lastFrame` とする
- 1つ前の手は「`lastFrame` より前で、`dirs` に入る最も新しいフレーム」を探す
- `motionFrames = lastFrame - firstFrame`、`buttonDelay = B - lastFrame`（式は同じ。`lastFrame` の決め方だけが変わる）
- 最後の手に `minHold` がある場合の `heldFrames` は、これまでどおり `f` から数える
- 前提: 隣り合う手の `dirs` は重ならない（DEFAULT_COMMANDS はすべてそうなっている）

例（`motionWindow: 15, buttonWindow: 6`）:
- 2,3 のあと 6 を 20F 押し続け、その 20F 目に P → `{ ok:false, reason:'button-late', buttonDelay:19 }`（これまでは `too-slow`）
- 2,3,6,6,6 で、最後の 6 のフレームで P → `{ ok:true, motionFrames:2, buttonDelay:2 }`

### D. 使い勝手

1. **割り当ての入れ替え**: `src/input/bindings.ts` に純粋な関数を足す

   ```ts
   /** action に code を割り当てる。code を別の操作が使っていたら、その操作に action の元のキーを渡して入れ替える */
   export function assignKey(
     keys: Readonly<Record<Action, string>>,
     action: Action,
     code: string,
   ): { keys: Record<Action, string>; swappedWith: Action | null };
   ```

   - 引数の `keys` は書き換えず、新しいオブジェクトを返す
   - 同じ操作に同じキーを割り当て直したときは `swappedWith: null`
   - パッドのボタン番号も同じ考えで `assignPad(pad, button, index)` を足す（返り値は `{ pad, swappedWith }`）
   - キーコンフィグ画面は入れ替えが起きたら「◯◯と入れ替えました」と表示する
2. **Esc で取り消し**: キーコンフィグの入力待ち中に Esc を押すと、割り当てを変えずに入力待ちを終える。Esc は割り当てられない
3. **「0 手目」の表示**: `incomplete` で `matchedSteps` が 0 のときは「最初の手（◯）が入っていません」と表示する

### 受け入れ条件（追加）

9. A の例が両方そのとおりになる。最後の手を押し続けた場合、`too-slow` ではなく `button-late` になる
10. `assignKey`・`assignPad` が入れ替えを正しく行い、引数を書き換えない
11. 既存の受け入れ条件 1〜7 も引き続き満たす（A に合わせて既存テストの期待値を直すのは可。ただし、そのテストが確かめたかったことは残す）

## この段階でやらないこと

- 2P 側（左向き）の反転、ゲーム別プリセット、コンボトライアル、アケコン・レバーレスの専用設定、デスクトップ化
