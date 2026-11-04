# 第3段階: 入力のタイミングを正しくし、遅れを測る

## 目的

開発者がプレイして「入力が遅れる」「判定がズレる」と感じた。コードを調べると、次の原因の候補があった（第2段階のレビューで調査）。

- B: 1回の rAF で数フレーム進めると、どのフレームも同じ入力状態を読む。押下が実際より最大 1F 早いフレームに記録される
- C: 経過時間の端数が境目に張り付くと「0 フレーム → 2 フレーム」が交互に出て、実質 30Hz で読む
- D: 1F より短いタップを取りこぼす
- E: 5 フレームを超える遅れは黙って捨てられ、時間が縮む

この段階では、キーボード入力を **イベントの時刻（`KeyboardEvent.timeStamp`）で正しいフレームに割り振る**。あわせて、遅れを画面に出して測れるようにする。測った数値を見て、デスクトップ化の方法（Tauri＋入力を Rust／全部ネイティブ）を決める。

判定ロジック（`src/core/detect.ts`・`combo.ts` など）は変えない。

## 構成

```
src/core/clock.ts      フレームの時計（純粋な関数）
src/core/stats.ts      計測値の集計（純粋な関数）
src/input/timeline.ts  キーイベントの列 → フレームごとの押下集合（DOM に依存しない）
src/input/keyboard.ts  keydown/keyup を時刻付きで timeline に積む（変更）
src/ui/metricsPanel.ts 計測の表示
src/main.ts            ループを clock と timeline で組み直す（変更）
tests/clock.test.ts, tests/timeline.test.ts, tests/stats.test.ts
```

## テストのコマンド

- `npm test`・`npm run typecheck`・`npm run build` がすべて終了コード 0

## 外から見える形（API）

### フレームの時計（`src/core/clock.ts`）

```ts
export const FRAME_MS: number; // 1000 / 60

/** フレーム n は [origin + n*FRAME_MS, origin + (n+1)*FRAME_MS) の時間。next は次に進めるフレームの番号 */
export interface FrameClock { readonly origin: number; readonly next: number; }

/** 最初の rAF の時刻から時計を作る。origin = firstNow - PHASE_LEAD_MS、next = 0（「変更 1」を参照） */
export function createFrameClock(firstNow: number): FrameClock;

/** フレーム n の終わりの時刻 = origin + (n + 1) * FRAME_MS */
export function frameEnd(clock: FrameClock, n: number): number;

/**
 * now までに終わったフレーム（終わりの時刻 <= now）を、clock.next から順に全部返す。
 * その数が maxCatchUp を超えたら、処理が止まっていたとみなして
 * { frameEnds: [], stalled: true, clock: createFrameClock(now) } を返す。
 */
export function dueFrames(
  clock: FrameClock,
  now: number,
  maxCatchUp: number,
): { clock: FrameClock; frameEnds: number[]; stalled: boolean };
```

- 返す `clock.next` は、進めたフレームの数だけ増える
- `frameEnds` は古い順
- main.ts では `maxCatchUp = 30`（0.5 秒）

### キーイベントの列（`src/input/timeline.ts`）

```ts
export interface KeyEvent { code: string; down: boolean; time: number; }

export class KeyTimeline {
  /** イベントを積む。順番は time で並べ直す（time が同じなら積んだ順） */
  push(e: KeyEvent): void;
  /**
   * time < frameEnd のイベントを古い順に取り出して押下状態に反映し、
   * 「このフレームで押されていた」コードの集合を返す。
   * = 反映後に押されているコード ∪ 取り出したイベントの中で down だったコード（フレーム内で押して離したタップも残す）
   * 取り出さなかったイベント（time >= frameEnd）は次の sample に残る
   */
  sample(frameEnd: number): ReadonlySet<string>;
  /** 押下状態と積んだイベントを全部消す（ウィンドウのフォーカスが外れたときなど） */
  clear(): void;
}
```

- すでに押されているコードの down は何もしない（キーリピート対策。タップとしても数えない）
- 押されていないコードの up は何もしない
- 前の `sample` で使った `frameEnd` より前の時刻のイベントが後から届いた場合は、次の `sample` で普通に取り出す（取りこぼさない）

### 計測値の集計（`src/core/stats.ts`）

```ts
/** 空なら null。mean は平均、max は最大 */
export function summarize(values: readonly number[]): { count: number; mean: number; max: number } | null;

/**
 * 0 以上の整数の値を数える。結果の長さは buckets。
 * 値 v は min(v, buckets - 1) 番目に数える（最後の箱は「それ以上」）。負の値は 0 番目
 */
export function histogram(values: readonly number[], buckets: number): number[];

/** 直近 capacity 個だけを持つ入れ物 */
export class Ring<T> {
  constructor(capacity: number);
  push(v: T): void;
  values(): T[]; // 古い順
}
```

## ループの動き（`src/main.ts`）

1. 最初の rAF で `createFrameClock(performance.now())`
2. 毎回の rAF で `now = performance.now()` を取り、`dueFrames(clock, now, 30)`
3. `frameEnds` の各フレームについて、古い順に:
   - キーボード: `timeline.sample(end)` の集合をキー割り当てで操作に変える
   - パッド: このフレームが今回の rAF で進める **最後** のフレームなら新しく読む。それより前のフレームは、前に読んだパッドの状態を使う（パッドは rAF のときにしか読めず、変わった時刻が分からないため）
   - 両方を OR で合成して `FrameInput` を作り、これまでどおり履歴・判定・トライアルを進める
4. `stalled` なら、トライアルを `reset` し、「処理が止まったため、この挑戦は無効です」と表示する
5. キーボードの keydown は `e.repeat` を無視し、`{ code, down: true, time: e.timeStamp }` を積む。文字入力欄からのイベントの扱いとキーコンフィグの `captureNext` は今までどおり。ウィンドウの blur で `timeline.clear()`

## 計測の表示（`src/ui/metricsPanel.ts`）

画面の隅に「計測」のチェックボックス。オンのときだけ、次の項目を 0.5 秒ごとに更新して表示する。

- **1回の描画で進んだフレーム数**: 直近 600 回の rAF について、0 / 1 / 2 / 3以上 の割合（%）
- **描画の間隔**: 直近 600 回の rAF の間隔の平均（ms）と、そこから出した Hz
- **キー入力から判定までの遅れ**: keydown の `time` から、そのイベントを取り出したフレームを処理した時点の `performance.now()` までの差。直近 60 回の平均と最大（ms）
- **パッドの更新間隔**: `Gamepad.timestamp` が変わったときの差。直近 60 回の平均と最大（ms）。パッドがなければ「パッドなし」
- **停止の検出回数**

前提: `KeyboardEvent.timeStamp` と `performance.now()` は同じ時計（ページの時間の原点からの ms）で測られている。この前提が崩れると「キー入力から判定までの遅れ」が負の値や極端に大きな値になるので、表示を見れば気づける。

## 受け入れ条件

1. `createFrameClock`・`frameEnd`・`dueFrames` が上の定義どおりに動く。境目ちょうど（終わりの時刻 == now）は「終わった」に含める。maxCatchUp ちょうどは止まり扱いにせず、1 超えたら止まり扱いになる
2. `KeyTimeline.sample` がイベントを時刻どおりのフレームに割り振る。1回の rAF で2フレーム進めた場合も、2フレーム目の途中で押したキーは2フレーム目に入り、1フレーム目には入らない
3. フレーム内で押して離したタップが、そのフレームの集合に残る。次のフレームには残らない
4. キーリピート（押下中の down）と、押していないキーの up は何もしない。`clear` で全部消える
5. `push` の順番が時刻とずれていても、時刻順に反映する
6. `summarize`・`histogram`・`Ring` が上の定義どおりに動く
7. 既存のテストがすべて通ったまま、`npm test`・`npm run typecheck`・`npm run build` が終了コード 0
8. ブラウザで「計測」をオンにすると各項目が表示される（開発者が手で確認）

## 変更 1（レビュー後: 境目の位置）

理由: 境目を rAF と rAF の真ん中に置くと、フレームが終わってから処理されるまでに半フレームかかる。そのぶん、画面に出るまでの遅れが平均で約 0.5F 増えていた（レビューでの計算による）。キーは時刻で割り振るので、rAF の揺れで 0→2 フレームが出ても判定はズレない。よって、境目を真ん中に置いて揺れを避ける必要は薄い。

- `export const PHASE_LEAD_MS = 2` を足す
- `createFrameClock(firstNow)` は `origin = firstNow - PHASE_LEAD_MS`、`next = 0`。これで境目は rAF の時刻（`firstNow + k * FRAME_MS`）の 2ms 手前に来る
- 代わりに起きること: rAF の揺れが 2ms を超える環境では 0→2 フレームが出やすくなる。そのあいだ、パッドは実質 30Hz で読まれる（パッドは rAF でしか読めないため）。計測パネルの「1回の描画で進んだフレーム数」で頻度を確かめる
- メモ: 画面が 60.000Hz ちょうどでない（59.94Hz など）と、境目が少しずつずれて rAF の時刻を横切り、0→2 フレームが出る期間ができる。キーボードには影響しない。パッドの読み取りの精度はデスクトップ化（Rust 側で時刻付きで読む）で解決する

## この段階でやらないこと

- パッドの時刻付き読み取り（ブラウザでは読めない。デスクトップ化で Rust 側で読む）
- 描画の遅れの短縮、デスクトップ化そのもの
