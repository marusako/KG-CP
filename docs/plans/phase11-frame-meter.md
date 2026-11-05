# 第11段階: 棒人間をやめ、スト6 風の 1 本のフレームメーターにまとめる

## 目的

- 棒人間（Canvas のステージ）をやめる。本家の動きを再現するのは難しいため（ユーザーの判断）
- 「技のフレームメーター」と「入力のフレームメーター」を、スト6 のトレーニングモードのフレームメーターを参考にした 1 本の帯にまとめる
  - 上の段: キャラの状態（発生・持続・硬直・動ける・ジャンプ）
  - 下の段: その瞬間の入力（方向とボタン）。同じフレームが縦にそろう
  - 技 → 動ける時間 → 次の技、を 1 本につなげる。動ける時間が 30F 続いたら区切る
  - 色の区間の上に、区間の長さの数字。5F ごとの目盛り。色の凡例

## スト6 のフレームメーターについて調べたこと（2026-11-05）

- 1 マス = 1 フレーム。技 1 つでもコンボ全体でも見られる（EventHubs、2022-09）
- 自分と相手の 2 段。色は 発生 = 緑、持続 = 赤、硬直 = 青、ヒット・ガードで固まっている間 = 黄（TheGamer 2023-06、gHacks 2023-06）。段の右端に硬直差（+5・−3 など）
- 無敵・アーマーなどの見た目は、記事によって説明が食い違う。公式の説明はゲーム内の「フレームメーターについて」
- 区切り方（何フレーム動けない／動けると帯が新しくなるか）は、資料で確かめられなかった。このアプリは 30F で区切る（ユーザーの判断）

相手の段（黄）と硬直差は、相手を置く段（2 段目）で足す。

## 外から見える形（API）

### 帯の中身（`src/core/frameMeter.ts`、新規）

```ts
/** 上の段のマスの種類。meterKindOf は moveMeter.ts から移す */
export type StateKind = 'free' | 'startup' | 'active' | 'recovery' | 'jump';
export function meterKindOf(state: FighterState): StateKind;

export interface FrameMeterCell {
  state: StateKind;
  dir: Direction;
  /** このフレームで新しく押されたボタン */
  pressed: readonly string[];
  /** このフレームで押されているボタン */
  held: readonly string[];
}
export interface FrameMeterState {
  cells: readonly FrameMeterCell[];
  /** 帯に積んでいる途中か（false なら止まっていて、前の帯を見せている） */
  recording: boolean;
  /** いまの末尾で、'free' かつボタンを押していないフレームが何フレーム続いているか */
  freeRun: number;
  /** 帯の中で技が始まったマスの位置と技（古い順） */
  starts: readonly { index: number; move: MoveFrames }[];
}
export const FRAME_METER_MAX = 120;   // 帯の長さの上限。超えたら古いほうから捨てる（starts の位置もずらし、範囲外は捨てる）
export const FRAME_METER_BREAK = 30;  // 動ける時間がこれだけ続いたら区切る
export const FRAME_METER_LEAD = 15;   // 帯を始めるとき、その前の入力を何フレーム分つけるか
export const EMPTY_FRAME_METER: FrameMeterState;  // { cells: [], recording: false, freeRun: 0, starts: [] }

/**
 * 1 フレーム進める。prev・next はそのフレームの前後のキャラの状態、history の最後がいまのフレーム。
 * - 止まっているとき: いまのフレームでボタンが新しく押されたか、技が始まった（next が startup の 0 フレーム目）ら、
 *   新しい帯を始める。帯の先頭には、いまのフレームより前の入力を最大 FRAME_METER_LEAD フレーム（state は 'free'）つけ、
 *   最後にいまのフレームのマスを足す。どちらでもなければ同じ state を返す（同じ参照）
 * - 積んでいるとき: いまのフレームのマスを足す。'free' でボタンを押していないフレームが FRAME_METER_BREAK 続いたら止める。
 *   止めるときは、末尾のその 'free' の続き（FRAME_METER_BREAK フレーム分）を帯から取り除く
 * - 技が始まったフレームは starts に足す
 */
export function stepFrameMeter(
  state: FrameMeterState,
  prev: FighterState,
  next: FighterState,
  history: readonly FrameInput[],
): FrameMeterState;

/** 処理が止まった（stall）とき: 積んでいる途中なら止める（帯はそのまま残す）。止まっていれば同じ state */
export function stopFrameMeter(state: FrameMeterState): FrameMeterState;

export interface StateSegment { state: StateKind; start: number; length: number }
/** 上の段の、同じ種類が続く区間（古い順）。数字を出すのに使う */
export function stateSegments(cells: readonly FrameMeterCell[]): StateSegment[];

/**
 * 先行入力のマス: ボタンが新しく押されたのに、そのマスの state が 'free' でない（技の途中・ジャンプ中に押した）
 */
export function isEarlyPress(cell: FrameMeterCell): boolean;
```

- 入力の部分（`pressed`・`held` の決め方）は、いまの `src/core/inputMeter.ts` の `meterCells` と同じ決まり（1 つ前のフレームで押されていないボタンが `pressed`。history の 1 つ目のフレームのボタンは `pressed`）
- `src/core/inputMeter.ts` は、`meterCells`・`MeterCell`・`meterRuns`・`MeterRun` だけ残す（下の段のまとめの文に使う）。`stepMeter`・`MeterState`・`INITIAL_METER`・`setMeterMode`・`MeterMode`・`METER_LENGTH` は消す
- `src/core/moveMeter.ts` は消す（`meterKindOf` は frameMeter.ts へ）

### 文（`src/i18n/messages.ts`）

- 見出し: 「フレームメーター」 / 「Frame meter」
- 帯の下の 1 行目（技の並び）: `frameMeterMoves(texts: readonly string[])` は `texts` を ` → ` でつなぐ。`texts` の 1 つは `moveMeterText(name, move)`（いまのまま）。技がないときは空
- 帯の下の 2 行目（入力の並び）: いまの `meterRunsText`（帯の入力の部分から作る）
- 凡例: `frameMeterLegend`（日本語 `緑: 発生（数 + 1 が発生のフレーム）　赤: 持続　青: 硬直　灰: 動ける　水色: ジャンプ　橙の枠: 先行入力`、英語も同じ内容）
- 案内: 帯が空のとき `ボタンを押すと、ここに帯が出ます` / `Press a button to start the meter`
- キャラなしのときは上の段がずっと 'free'（灰）。凡例の下に、いまの `moveMeterNoCharacter` を出す
- 使わなくなった文（入力のメーターの「ボタンで止める」「流す」、棒人間の文など）は消す

### 画面（`src/ui/frameMeterView.ts`、新規）

- 1 本の帯。マスは縦に 2 段（上: 状態の色、下: 方向の矢印と、新しく押したボタン名）
- 上の段の区間の上に長さの数字。区間が 1 マスでも出す。帯の先頭の 'free'（入力だけの部分）には出さない
- 目盛り: 帯の先頭から 5 マスごとに薄い線、10 マスごとに濃い線
- 先行入力のマス（`isEarlyPress`）は、下の段を橙の枠で囲む
- 帯が画面より長いときは横スクロール。積んでいる間は右端が見えるように送る
- マスの要素は使い回し、変わったところだけ書く（第9段階と同じ）
- 帯の下: 技の並びの文、入力の並びの文、凡例
- 置き場所: 練習画面のタブの上（いまの棒人間と技のメーターの場所）

### 消すもの

- `src/ui/stageView.ts`・`src/ui/moveMeterView.ts`・`src/ui/inputMeterView.ts`・`src/core/moveMeter.ts`
- それぞれの CSS と main.ts の配線、使わなくなった文
- テスト: `tests/moveMeter.test.ts` は消し、`meterKindOf` と `moveMeterText` のテストは `tests/frameMeter.test.ts` へ移す。`tests/inputMeter.test.ts` は残す関数の分だけにする
- `src/core/fighter.ts` の横の位置 `x` とジャンプの向き `jumpDir` は、棒人間を描くためだけのものなので消す（状態の移り方は変えない）
- `docs/manual-checks.md` の 14・15 は、新しい「16. フレームメーター（1 本）」に置き換える（14・15 は「第11段階で置き換え」と書いて残す）

### main.ts

- 1 フレームごとに `stepFighter` → `stepFrameMeter`。技が始まったフレームで、その技の文（`moveMeterText(moveDisplayName(...), move)`）を作って持っておく（毎フレーム作らない）
- 処理が止まったときは `stopFrameMeter` と、キャラを最初に戻す
- 練習画面に入ったとき・キャラやゲームを変えたときは、空の帯に戻す
- 描くのは練習画面にいるときだけ

## 受け入れ条件

1. `stepFrameMeter`
   - 止まっているとき、ボタンを押していなければ同じ state（同じ参照）を返す
   - ボタンを押したフレームで帯が始まる。先頭に、その前の入力が最大 15 フレームつく（history が短ければ、ある分だけ）。先頭の部分の state は 'free'
   - 技が始まったフレームで `starts` に足される。キャミィの 5LP なら、上の段は startup 3・active 3・recovery 7 と並ぶ
   - 5LP のあと 2F 動いてから 2LP: 上の段が startup 3・active 3・recovery 7・free 2・startup 3… と 1 本につながる
   - 'free' でボタンを押していない状態が 30F 続くと止まり、その 30F は帯から消える。止まったあとは同じ state を返す
   - 'free' の間にボタンを押すと（技が出なくても）、`freeRun` は 0 に戻る
   - 120 マスを超えたら古いほうを捨て、`starts` の位置もずれる（範囲外になったものは消える）
   - キャラなし（技が出ない）でも、ボタンを押せば下の段の帯ができる
2. `stopFrameMeter`: 積んでいる途中なら `recording` を false にし、cells はそのまま
3. `stateSegments`: 同じ種類の続きを区間にする。例: free 2・startup 3・active 3・recovery 7 のマスなら `[{free,0,2}, {startup,2,3}, {active,5,3}, {recovery,8,7}]`。空なら空
4. `isEarlyPress`: 技の途中・ジャンプ中に新しく押したマスは true、'free' で押したマス・押していないマスは false
5. `meterKindOf` は今と同じ（idle・crouch・walk は free、prejump・air・landing は jump）
6. `fighter.ts` から `x`・`jumpDir` が消えても、状態の移り方のテストは今と同じ結果
7. 文: `frameMeterMoves`（` → ` でつなぐ、空なら ''）、`moveMeterText`（今と同じ形）、凡例と案内が日本語・英語にある
8. `npm test`・`npm run typecheck`・`npm run build`・`npx madge --circular --extensions ts src` がすべて終了コード 0。`src/` の文字列リテラルに日本語を書かない

画面（2 段の見た目、数字、目盛り、橙の枠、横スクロール、凡例、スマホ幅、重さ）は `docs/manual-checks.md` の「16」に書く。

## テストのコマンド

- `npm test`・`npm run typecheck`・`npm run build`・`npx madge --circular --extensions ts src` がすべて終了コード 0

## 構成

```
src/core/frameMeter.ts      新規
src/core/inputMeter.ts      状態の部分を消す（変更）
src/core/moveMeter.ts       消す
src/core/fighter.ts         x・jumpDir を消す（変更）
src/ui/frameMeterView.ts    新規
src/ui/stageView.ts・moveMeterView.ts・inputMeterView.ts  消す
src/i18n/messages.ts・src/main.ts・src/ui/style.css（変更）
docs/manual-checks.md       16 を足す
tests/frameMeter.test.ts    新規。tests/moveMeter.test.ts は消す。tests/inputMeter.test.ts・tests/fighter.test.ts は合わせて直す
```

## テストで決めた細部（test-writer の仮定を採用）

- 帯のマスの `state` は `meterKindOf(next)`（そのフレームのあとの状態）。技が始まったフレームのマスは 'startup'
- `starts` の `index` は、帯の中のマスの位置（先頭の入力の部分も数える）。120 を超えて捨てたとき、ちょうど 0 になるものは残す
- 止まるのは、'free' でボタンを押していないフレームが 30 フレーム目になったとき。そのフレームで、末尾の 30 マスを取り除いて `recording` を false にする（29 フレーム目までは積んでいる）
- 先頭の入力の部分（最大 15F）は、`dir`・`pressed`・`held` とも history のそのフレームどおり
- `frameMeterLegend`・`frameMeterEmpty` は文字列。日本語の凡例は上の「文」の節に書いた文そのまま
- （実装中に追記）マスの state は「そのフレームのあと」の状態なので、動ける状態で押して技が始まったマスも 'startup' になる。これを先行入力と見分けるため、`FrameMeterCell` に任意の `moveStart?: true`（技が始まったマスだけ）を足し、`isEarlyPress` は `moveStart` のマスを false にする
