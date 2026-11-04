# 処理が止まったときの扱いを直す

## 目的

画面の処理が 0.5 秒（30 フレーム）より長く止まると、「停止」として検出している（`src/core/clock.ts` の `dueFrames` が `stalled: true` を返す）。タブの切り替えや、重い処理で起きる。いまは、そのときの扱いに次の 3 つの問題がある（`docs/manual-checks.md` の「残っている提案」より）。

1. 入力履歴が、止まる前と後でつながったまま判定される。たとえば、止まる前に 2 を入れ、止まったあとに 36P と入れると、間に長い停止があったのに 236P が成立しうる
2. コンボトライアルの「処理が止まったため、この挑戦は無効です」が、挑戦していないときも出る
3. 止まったときの描画の間隔（数百 ms〜数秒）が計測に混ざり、「描画の間隔」の平均と Hz がずれる。その回の「進んだフレーム数 0」も混ざる

判定の中身（`detect.ts`・`stepTrial` など）は変えない。

## 構成

```
src/core/history.ts    historyAfterStall を足す
src/core/combo.ts      isAttemptInProgress を足す
src/core/stats.ts      RafMeter を足す
src/ui/comboPanel.ts   invalidate を「挑戦の途中だけ」にする（変更）
src/ui/metricsPanel.ts RafMeter を使う。onRaf に stalled を足す（変更）
src/main.ts            停止のとき履歴を historyAfterStall で置き換える（変更）
tests/history.test.ts, tests/combo.test.ts, tests/stats.test.ts（足す）
```

## テストのコマンド

- `npm test`・`npm run typecheck`・`npm run build` がすべて終了コード 0

## 外から見える形（API）

### 停止のあとの履歴（`src/core/history.ts`）

```ts
/**
 * 停止を検出したとき、入力履歴をこれに置き換える。
 * 空なら空の配列。そうでなければ、最後のフレームのボタンだけを残し、方向をニュートラル（5）にした 1 フレームだけの配列。
 */
export function historyAfterStall(history: readonly FrameInput[]): FrameInput[];
```

1 フレームだけ残す理由: 止まる前から押し続けているボタンが、止まったあとに「新しく押した」扱いにならないようにするため。押した瞬間の判定（`justPressedAny`）は、直前のフレームと比べている。方向をニュートラルにするのは、止まる前の方向がモーションの一部として使われないようにするため。

### 挑戦の途中か（`src/core/combo.ts`）

```ts
/** 最初の手が成立し、まだ完走も失敗もしていないとき true */
export function isAttemptInProgress(state: TrialState): boolean;
```

### 描画の計測（`src/core/stats.ts`）

```ts
/** rAF ごとの「進んだフレーム数」と「前の rAF からの間隔」を、直近 capacity 個まで持つ */
export class RafMeter {
  constructor(capacity: number);
  /**
   * rAF ごとに呼ぶ。now は時刻（ms）、steps はその rAF で進めたフレーム数。
   * stalled が true の回は、間隔もフレーム数も記録しない（時刻だけ覚え、次の回の間隔は記録する）
   */
  onRaf(now: number, steps: number, stalled: boolean): void;
  /** 古い順 */
  steps(): number[];
  /** 古い順。最初の rAF には前がないので、間隔は記録しない */
  intervals(): number[];
}
```

### 画面

- `ComboPanel.invalidate(reason)`: 挑戦の途中（`isAttemptInProgress` が true）なら、いまと同じく最初の手に戻して理由を出す。途中でなければ何もしない（前の結果の表示も、そのまま残す）
- `MetricsPanel.onRaf(now, steps, stalled)`: `RafMeter` に渡す。停止の検出回数は、いまと同じく `onStall` で数える
- `main.ts`: `due.stalled` のとき、`history` の中身を `historyAfterStall(history)` で置き換える（同じ配列を使い回すなら、中身を入れ替える）。`metrics.onRaf` に `due.stalled` を渡す

## 受け入れ条件

1. `historyAfterStall`
   - 空の履歴 → 空の配列
   - 最後のフレームが `{ dir: 2, buttons: ['LP'] }` なら `[{ dir: 5, buttons: ['LP'] }]`
   - 元の配列と、その中のオブジェクト・`buttons` 配列を変えない（返す値は別の配列。中身を変えても元に響かない）
   - 置き換えたあとの履歴に、止まる前の方向が残らない。例: 止まる前に 2 を入れていて、置き換えたあとに 3→6→6+LP と入れても、236LP（`DEFAULT_COMMANDS` の 236P）は成立しない
   - 止まる前から押し続けているボタンは、置き換えたあとの最初のフレームで「押した瞬間」にならない（`justPressedAny` が false）。一度離して押し直せば、押した瞬間になる
2. `isAttemptInProgress`
   - `initialTrialState()` → false
   - 1 手目が成立したあと（`stepTrial` が `hit` を返したあとの状態）→ true
   - 完走（`complete`）や失敗（`drop`）のあとの状態 → false
3. `RafMeter`
   - 最初の `onRaf` では間隔を記録せず、2 回目から前の回との差を記録する
   - `stalled: true` の回は、間隔もフレーム数も記録しない。その次の回（`stalled: false`）の間隔は、停止した回の時刻との差で記録する
   - `capacity` を超えたら古いものから消える（`steps` と `intervals` の両方）
4. 画面（手で確かめる。`docs/manual-checks.md` に足す）
   - コンボトライアルで、挑戦していないときにタブを切り替えて戻っても「無効」が出ない。2 手目以降を待っている途中で切り替えると、いまと同じく出る
   - コマンド練習で、2 を入れたまま別のタブに切り替えて戻り、36P と入れても 236P が成立しない
   - 別のタブに切り替えて戻っても、「描画の間隔」の平均が大きく跳ねない

## やらないこと

- 0.5 秒より短い止まりの扱いは変えない（いまのとおり、キーは時刻で正しいフレームに割り振る）
- キー入力の遅れの計測は変えない
- 止まっている間に離して押し直したボタンは、止まったあとに押し続けていると押した瞬間にならない。まれなので、この段階では扱わない
