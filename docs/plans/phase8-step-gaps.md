# 第8段階: 方向と方向の間の猶予（GG）

## 目的

GG のコマンドの判定を、「方向と方向の間ごとの猶予」で行う。いまは「最初の方向から最後の方向まで」の合計（`motionWindow`）だけで見ているが、GG は方向ごとに猶予が決まっている。

スト6 は変えない（方向の間の値の出典が、有志のまとめの 1 行「必殺技は 7F、超必殺技は 11F」だけで、コマンドごとの値がないため）。

## 調べたこと（2026-11-05 時点）

### 出典

- Dustloop の「GGST - Esoterica」ページ（https://www.dustloop.com/w/GGST/Esoterica ）。本体は自動の取得を拒否するので、検索結果の抜粋で確認した
  - 方向は「手」の並びで、手と手の間には、ほかの入力が入ってもよい
  - 数字は「前の手から次の手を入れるまでの時間」
  - 先頭の `i` は最初の入力で、離すまで覚えておかれる。なので最初の手には時間の制限がなく、2 つ目の手までの時間だけがある
  - 236236 は `i-5-17-17-11e`。最後の 2 か 6 のどちらかは 3 でもよい
- 有志のまとめ（Notion、2026-10-26 更新。Dustloop の翻訳）の表
  - 236 `i-5-10-9e`、623 `i-8-12-6e`、41236 `i-5-12-12-12-11e`、632146 `i-6-12-12-12-12-11e`、[4]6 `30i-10-9e`、360 `i-30e`

### 読み替え（推測を含む）

- 数の個数が「手の数 − 1 ＋ 1」なので、最後の `…e` は「最後の方向からボタンまで」と読む（`e` の意味は書かれていない。**推測**）
- 「時間」は「前の手を入れたフレームから、次の手を入れたフレームまでの差」が、その数以下なら成功と読む（「数 − 1」ではなく、そのままの数。**推測**）
- 最初の手だけは「離したフレーム」から数える（`i` の説明から）。2 つ目からの手は「入れたフレーム」から数える
- [4]6 の `30i` は、溜めが 30F 以上と読む。まとめの表には「4（25F）」ともあり、食い違う。Dustloop の 30 を使う
  - （2026-11-05 追記）wikiwiki「初心者ガイド/コマンド入力」に「Ver.2.0 で 30F→25F に短縮」とあったので、溜めは 25F に直した。Dustloop の 30 は Ver.2.0 より前の値と考えられる（推測）
- 214 と 63214 は表にない。236 と 41236 の左右を入れ替えた形なので、同じ値にする（**推測**。コメントに書く）

## 使う値

| コマンド | 手 | 手の間（`stepGaps`） | ボタンまで（`buttonWindow`） | 溜め |
|---|---|---|---|---|
| gg-236 | 2・3・6 | 5, 10 | 9 | |
| gg-214 | 2・1・4 | 5, 10（236 と同じ。推測） | 9 | |
| gg-623 | 6・2・3 | 8, 12 | 6 | |
| gg-41236 | 4・1・2・3・6 | 5, 12, 12, 12 | 11 | |
| gg-63214 | 6・3・2・1・4 | 5, 12, 12, 12（41236 と同じ。推測） | 11 | |
| gg-632146 | 6・3・2・1・4・6 | 6, 12, 12, 12, 12 | 11 | |
| gg-[4]6 | [4]・6 | 10 | 9 | `minHold` 30 |

- `motionWindow` は `stepGaps` の合計にする（`incomplete` の見る範囲に使うため）
- 変えないもの: gg-236236・gg-214214（手の形が Dustloop と違う。Dustloop は 2-6-2-6）、gg-360（`i-30e` の読み方が分からない）。これらは今の共通の値のまま
- 画面のバーの GG の注記を「一部の猶予は有志の資料（Dustloop）の値です」にする（英語も）

## 外から見える形（API）

### コマンドの定義（`src/core/types.ts`）

motion の `CommandDef` に任意の `stepGaps?: readonly number[]` を足す。長さは `steps.length - 1`。`stepGaps[k]` は、手 k から手 k+1 までの最大フレーム数。

### 判定（`src/core/detect.ts` の `analyzeAttempt`）

`stepGaps` があるとき、溜めの確認のあと、`motionWindow` の確認の前に、手の間を確かめる。

- 手 k の「入れたフレーム」`entry(k)`: 後ろから探して見つけた手 k のフレームから、同じ手の方向が続く区間の先頭
- 手 k の「数え始め」`ref(k)`: k = 0 なら、見つけた手 0 のフレーム（手 1 より前で、手 0 の方向だった最後のフレーム。つまり離す直前）。k ≥ 1 なら `entry(k)`
- `gap(k) = entry(k + 1) - ref(k)`。`gap(k) > stepGaps[k]` なら失敗
  - `{ ok: false, reason: 'step-slow', stepIndex: k + 1, frames: gap(k), limit: stepGaps[k] }`（`stepIndex` は遅かった手の番号。0 から数える）
  - 前の手から順に見て、最初に遅かった所を返す
- （レビュー後に追記）後ろから一番新しいフレームを選ぶ方法だけだと、同じ方向が 2 回出る入力（例: `2, 3, 6×4, 3, 6+P`。236 を入れたあと 3 にぶれた）で、正しく入れたのに失敗になる。そこで、上の決め方で失敗したときは、**ほかの選び方も探す**
  - 選び方: 手 0 は「手 1 より前で、手 0 の方向だった任意のフレーム」を `ref(0)` に、手 k（k ≥ 1）は「手 k の方向が続く区間の先頭」のどれかを `entry(k)` に選ぶ。`entry(k)` は前の手より後ろ
  - 条件: すべての k で `0 < entry(k + 1) - ref(k) ≤ stepGaps[k]`、`b - entry(最後) ≤ buttonWindow`、溜めがあれば `ref(0)` で終わる溜めが `minHold` 以上
  - 条件を満たす選び方が 1 つでもあれば成功（`motionFrames` は `entry(最後) - ref(0)`、`buttonDelay` は `b - entry(最後)`）。なければ、上の決め方の失敗をそのまま返す（文の出し方は変えない）
- 全部の間が猶予内なら、いまと同じく `motionWindow`・`buttonWindow` を確かめる
- `stepGaps` がないコマンドは、いまと同じ動き

`AttemptResult` に `{ ok: false; reason: 'step-slow'; stepIndex: number; frames: number; limit: number }` を足す。

### 文（`src/i18n/messages.ts`、`describeResult`）

- 日本語: `{前の手の方向} から {遅かった手の方向} が遅すぎます（{frames}F、猶予 {limit}F）` 例: `2 から 3 が遅すぎます（7F、猶予 5F）`
- 英語: `Too slow from {前} to {次} ({frames}F, limit {limit}F)`
- 方向は手の `dirs` を `/` でつなぐ（`describeResult` はコマンドの定義を受け取らないので、`AttemptResult` に `from: readonly Direction[]` と `to: readonly Direction[]` も入れる）

## 受け入れ条件

1. 上の表のとおりの GG のコマンドの値（`stepGaps`・`buttonWindow`・`minHold`・`motionWindow` = 合計）。236236・214214・360 は今のまま。スト6 のコマンドは変わらない
2. 判定（236、`stepGaps` [5, 10]、`buttonWindow` 9 の例）
   - 2 を 20F 押し続けてから 3 を入れ、すぐ 6、P → 成功（最初の手は離した所から数える）
   - 2 の最後のフレームから 5F 後に 3 → 成功。6F 後 → `step-slow`（`stepIndex` 1、`frames` 6、`limit` 5、`from` [2]、`to` [3]）
   - 2 と 3 のあいだにニュートラル（5）が入っても、間が 5F 以内なら成功
   - 3 を 11F 押し続けてから 6 → `step-slow`（`stepIndex` 2、`frames` 11、`limit` 10）。3 は入れた所から数える
   - 6 から 9F 後に P → 成功、10F 後 → `button-late`
   - 2 も 3 も遅いときは、前の `stepIndex` 1 を返す
3. `stepGaps` がないコマンドは、いまのテストがそのまま通る
4. 溜め（[4]6、`minHold` 30、`stepGaps` [10]）: 4 を 30F 溜めて離し、10F 以内に 6 → 成功。29F → `charge-short`。離してから 11F 後に 6 → `step-slow`
5. `describeResult` の `step-slow` が、日本語と英語で上の形になる
6. `npm test`・`npm run typecheck`・`npm run build`・`npx madge --circular --extensions ts src` がすべて終了コード 0

画面での感覚（実機の GG と比べて、厳しすぎ・ゆるすぎがないか）は `docs/manual-checks.md` の「13」に書く。

## テストのコマンド

- `npm test`・`npm run typecheck`・`npm run build`・`npx madge --circular --extensions ts src` がすべて終了コード 0

## 構成

```
src/core/types.ts      stepGaps と step-slow（変更）
src/core/detect.ts     手の間の判定（変更）
src/core/commands.ts   GG の値と出典のコメント（変更）
src/i18n/messages.ts   step-slow の文、GG の注記（変更）
src/ui/commandPanel.ts describeResult（変更）
docs/manual-checks.md  13 を足す
tests/                 detect・commands・i18n に足す
```
