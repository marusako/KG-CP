# 第9段階: 入力のフレームメーター

## 目的

自分の入力を、1 フレーム 1 マスの帯で見せる。「2 を何 F 押して、3 に何 F で移って、6 の何 F 目にボタンを押したか」が一目で分かるようにする。技のフレームデータは使わない（それは技のフレームメーターと棒人間の段で扱う）。

- 練習画面（コマンド練習・コンボトライアルの両方）に出す
- 初めは「ボタンで止める」: ボタンを押した瞬間までの帯を残し、次にボタンを押すまで止めておく。入れた直後にゆっくり見直せる
- 「流す」にすると、いまの入力が流れ続ける
- 帯の下に、同じ方向が続いた区間のまとめを出す。例: `2 (3F) → 3 (1F) → 6 (2F) + P`

## 外から見える形（API）

### メーターの中身（`src/core/inputMeter.ts`、新規）

```ts
export const METER_LENGTH = 60;

export interface MeterCell {
  dir: Direction;
  /** このフレームで新しく押されたボタン（前のフレームでは押されていない） */
  pressed: readonly string[];
  /** このフレームで押されているボタン */
  held: readonly string[];
}

/** history の最後から length フレーム分のマス（古い順）。足りなければ、ある分だけ */
export function meterCells(history: readonly FrameInput[], length?: number): MeterCell[];

export interface MeterRun {
  dir: Direction;
  /** 何フレーム続いたか */
  frames: number;
  /** この区間の中で新しく押されたボタン（押された順、重なりなし） */
  pressed: readonly string[];
}
/** 同じ方向が続く区間にまとめる（古い順）。ボタンが押されても区間は切らない */
export function meterRuns(cells: readonly MeterCell[]): MeterRun[];

export type MeterMode = 'freeze' | 'live';
export interface MeterState {
  mode: MeterMode;
  /** 表示しているマス */
  cells: readonly MeterCell[];
}
export const INITIAL_METER: MeterState;   // { mode: 'freeze', cells: [] }
/**
 * 1 フレーム進める（history の最後がいまのフレーム）。
 * live: いつも最新の length フレームを出す。
 * freeze: いまのフレームでボタンが新しく押されたときだけ、最新の length フレームに入れ替える。それ以外は前のまま
 */
export function stepMeter(state: MeterState, history: readonly FrameInput[], length?: number): MeterState;
export function setMeterMode(state: MeterState, mode: MeterMode): MeterState;  // モードだけ変える。cells はそのまま
```

- 1 フレーム目（history が 1 つ）のボタンは、前のフレームがないので「新しく押された」とする（`justPressedAny` と同じ考え方）
- `meterCells` の `pressed` は、マスの範囲の外（1 つ前のフレーム）も見て決める

### まとめの文（`src/i18n/messages.ts`）

- `meterRunsText(runs)` の形は日本語・英語とも `2 (3F) → 3 (1F) → 6 (2F) + P`（方向は数字、ボタンは区間の後ろに `+ P`。複数なら `+ P + K`）。言語で変わるのは見出しとボタンの名前（「ボタンで止める」「流す」）だけ
- 見出し: 「フレームメーター」 / 「Frame meter」

### 画面（`src/ui/inputMeterView.ts`、新規）

- 帯: 60 マスを横に並べる。マスには方向の矢印（入力履歴と同じ記号）。ボタンが新しく押されたマスは色を変えて、下にボタン名を小さく出す。ボタンを押しているマスは薄く色を付ける
- 見た目は作りこまない（色は 3 つ程度、線は細く）。スマホ幅では横スクロールでよい（マスは小さくしない）
- 帯の下に区間のまとめの文
- 見出しの横に「ボタンで止める / 流す」の切り替え。選んだモードは保存しない（開くたびに「ボタンで止める」）
- 練習画面の入力履歴の上に置く

### main.ts

- 1 フレームごとに `stepMeter` を呼び、変わったときだけ描き直す
- 処理が止まったとき（stall）は、`history` を置き換えたあとに `stepMeter` は呼ばない（止める前の帯を残す）
- 練習画面に入ったとき、メーターを空に戻す

## 受け入れ条件

1. `meterCells`
   - 最後の `length` フレームだけを、古い順に返す。history が短ければ、ある分だけ
   - `pressed` は「そのフレームで押されていて、1 つ前のフレームでは押されていない」ボタン。マスの範囲の 1 つ前のフレームも見る（範囲の先頭で押しっぱなしのボタンは `pressed` にならない）
   - history の 1 つ目のフレームで押されているボタンは `pressed`
2. `meterRuns`
   - 例: 2,2,2,3,6,6+P → `[{2,3F,[]},{3,1F,[]},{6,2F,['P']}]`
   - ボタンが押されても区間は切れない。同じ区間で 2 回押されたボタンは 1 つにまとめる
   - 空なら空
3. `stepMeter`
   - live: いつも最新の `length` フレーム
   - freeze: ボタンが新しく押されたフレームだけ入れ替わる。押しっぱなしでは入れ替わらない。押していないときは前のまま
   - `setMeterMode` は cells を変えない
4. まとめの文: 例 2 のときに `2 (3F) → 3 (1F) → 6 (2F) + P`。日本語と英語で同じ。複数ボタンは `+ P + K`。区間が 0 個なら空の文字列
5. `npm test`・`npm run typecheck`・`npm run build`・`npx madge --circular --extensions ts src` がすべて終了コード 0

画面（帯の見た目、止まる・流れる、スマホ幅）は `docs/manual-checks.md` の「14」に書く。

## テストのコマンド

- `npm test`・`npm run typecheck`・`npm run build`・`npx madge --circular --extensions ts src` がすべて終了コード 0

## 構成

```
src/core/inputMeter.ts     メーターの中身（新規）
src/ui/inputMeterView.ts   画面（新規）
src/i18n/messages.ts       見出し・切り替え・まとめの文（変更）
src/main.ts                1 フレームごとに進める（変更）
src/ui/style.css           帯の見た目（変更）
docs/manual-checks.md      14 を足す
tests/inputMeter.test.ts   新規
```
