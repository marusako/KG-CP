# 第5段階 ③: ゲームごとの猶予と先行入力

## 目的

- スト6 のコマンドのボタン猶予を、公開されている資料の値にする（出典と日付をコメントに書く）
- コンボトライアルに先行入力を入れる。窓が開く少し前に押しても成功にする
- GG は、決めたとおり共通の値を使う（ボタン猶予はいまのまま、先行入力は 4F）

## 調べたこと（2026-11-05 時点）

### コマンドのボタン猶予（最後の方向からボタンまで）

- 公式（Season 2 パッチノート、2024-05-21。EventHubs の記事 https://www.eventhubs.com/news/2024/may/21/sf6-season-2-patch-notes で確認）
  - 「最後の前（または後ろ）の入力から 9 フレーム以内に攻撃ボタンを押す必要がある」
  - 地上の 236・214: 11F → 9F。空中は 11F のまま
  - 41236・63214: 12F → 9F
- 有志の検証（WydD、2023 年、https://rentry.co/35ch3）
  - 236 は 11F、半回転は 12F。どちらも Season 2 前の公式の値と同じなので、同じ「ボタンまで」の値と読める
  - 623 は 7F。Season 2 で変わったという記載は見つからなかった
  - 先行入力は「5 通りのフレーム（ちょうどの 1F と、早く押した 4F）」。目押し・必殺技・起き上がりで共通
- 最初の方向から最後の方向まで（`motionWindow`）の値は、どの資料にもなかった
- 360 は資料が食い違う（32F 説と、21F＋ボタン 20F 説）。溜めはキャラによって違う（45〜50F 以上）

### 先行入力

- スト6: 上の WydD の資料で 5 通り（早押しは 4F）。起き上がりは 4F→7F に延長（公式、2023-12、https://eventhubs.com/news/2023/dec/01/sf6-outfit3-update-patch-notes）。ドライブインパクトなど一部の技は 5F→10F（Season 2）
- GG: Ver1.10（2021-10）で「先行入力の受付時間を全体的に延長」とあるが、フレーム数は書かれていない。Steam の掲示板に「攻撃ボタンは 5F」という書き込みがある。あとから、Dustloop を翻訳した有志のまとめ（Notion、2026-10-26 更新）で「先行入力は 4F（リバーサルの緩和なし）」と分かり、4F の出典にした。同じまとめにある、方向と方向の間の猶予（必殺技 10F など）は次の段で扱う
- メルブラ: 数値は見つからなかった

### 数え方の読み替え（推測）

「9F」は「ボタンを押してよいフレームが 9 通り」と読む。最後の方向と同じフレームに押したときが 0 なので、`buttonWindow` は 8 になる。WydD の「5 通り＝ちょうどの 1F と早めの 4F」と同じ数え方に合わせた。実機で確かめる項目を `docs/manual-checks.md` に書く。

## 変えること

### スト6 のコマンド（`src/core/commands.ts`）

| id | buttonWindow | 変わるか |
|---|---|---|
| 236P・214P | 8 | 6 → 8 |
| 41236P・63214P | 8 | 6 → 8 |
| 623P | 6 | そのまま（7F を 6 と読む） |
| [4]6P・[2]8K | 6 | そのまま（資料なし） |

- `motionWindow`・`minHold`・360P の `motionWindow` は変えない
- スト6 の値の近くに、出典・日付・読み替えのコメントを書く
- GG のコマンドは変えない（共通の値 `BUTTON_WINDOW = 6` などを使い続ける）。共通の値には「仮の値」のコメントを残す

### ゲームの設定（`src/core/profiles.ts`）

`GameProfile` に `inputBuffer: number` を足す。窓が開く何フレーム前までの早押しを成功にするか。

- `sf6`: 4
- `ggst`: 4（共通の値）

### コンボの判定（`src/core/combo.ts`）

`stepTrial(state, recipe, history, frame, inputBuffer = 0)`。5 番目の引数を足す。省略したときは 0 で、今と同じ動きになる。

2 手目より後の手で、入力が合ったとき（`offset = frame - lastPressFrame`）:

- `offset >= window.min`: いまと同じく成功。次の手の基準は `frame`
- `window.min - inputBuffer <= offset < window.min`: **先行入力で成功**。イベントは `hit`（最後の手なら `complete`）で、`offset` は実際に押した値のまま。次の手の基準（`lastPressFrame`）は、技が実際に出るフレーム `frame + (window.min - offset)` にする
- `offset < window.min - inputBuffer`: いまと同じく `drop`（`early`）

次の手の基準が未来のフレームになったとき、`offset` はマイナスになることがある。そのときも、上の決まりのまま判定する。`wrong`（違うボタン）と `late`（`offset > window.max`）は、いまのまま。

`TrialState`・`TrialEvent`・レシピの JSON の形は変えない。保存済みのレシピもそのまま読める。

### 画面（`src/ui/comboPanel.ts`）

- `stepTrial` に `profile.inputBuffer` を渡す
- 先行入力で成功した手は、手の下に `+{offset}F（先行 {window.min - offset}F）` と出す。例: 窓 `[10, 14]` で 8F 目に押したら `+8F（先行 2F）`
- 手の下の文は `describeHit(offset, window)` で作る（`src/ui/comboPanel.ts` から export）
  - `offset` が null（最初の手）: `OK`
  - `offset >= window.min`: `+{offset}F`
  - `offset < window.min`: `{offset の符号つき}F（先行 {window.min - offset}F）`。offset が 0 以上なら `+8F（先行 2F）`、マイナスなら `-1F（先行 1F）`（前の手が先行入力で、まだ技が出る前に押したとき）
- `describeDrop(e, recipe, inputBuffer = 0)`: `early` の文を `早い（あと {window.min - inputBuffer - offset}F 遅く）` にする（成功になる範囲までの差）
- 窓の表示（`10〜14F`）は変えない

### ゲームのバー（`src/ui/screens.ts` の `createGameBar`）

- `sf6`: `一部の猶予は公開資料の値です（2024年5月時点）`
- `ggst`: `猶予は共通の値です`（いまのまま）

### 手で確かめること（`docs/manual-checks.md`）

「10. ゲームごとの猶予と先行入力」を足す。

- 実機のスト6 で、236 の最後の方向から 8F 目・9F 目にボタンを押したとき、出るかどうか（9F の読み替えが合っているか）
- アプリで、窓の 1〜4F 前に押すと「先行」と出て成功し、5F 前だと「早い」になるか
- 先行入力のあとの次の手の目押しが、実機と同じ感覚か

## 受け入れ条件

1. スト6 の 236P・214P・41236P・63214P の `buttonWindow` が 8、623P・[4]6P・[2]8K は 6。その他の値（`motionWindow`・`minHold`・360P）と、GG のコマンドの値は変わらない
2. `PROFILES.sf6.inputBuffer` と `PROFILES.ggst.inputBuffer` が 4
3. `stepTrial` を 4 つの引数で呼んだときの動きは、いまと同じ（既存のテストがそのまま通る）
4. `inputBuffer = 4`、窓 `[10, 14]` のとき:
   - 6〜9F 目に押すと成功。`offset` は押した値
   - 5F 目に押すと `drop`（`early`）
   - 10〜14F 目はいまと同じ。15F 目を過ぎると `late`
5. 先行入力で成功したあと、次の手の `offset` は、技が出るフレーム（前の手の基準 ＋ `window.min`）から数える
   - 例: 1 手目が通算 100F、2 手目が窓 `[10, 14]` で 108F に先行入力で成功した。このとき、3 手目（窓 `[0, 10]`）の基準は 110F になる。117F に押すと `offset` は 7
6. 先行入力で成功した手が最後の手なら `complete` になる
7. `describeDrop` は、`inputBuffer` を渡すと「成功になる範囲まであと何 F 遅く」を返す。渡さないといまと同じ文になる
8. `npm test`・`npm run typecheck`・`npm run build` がすべて終了コード 0

## テストのコマンド

- `npm test`・`npm run typecheck`・`npm run build` がすべて終了コード 0

## 変えるファイル

```
src/core/commands.ts   スト6 のボタン猶予と出典のコメント
src/core/profiles.ts   inputBuffer を足す
src/core/combo.ts      stepTrial に inputBuffer を足す
src/ui/comboPanel.ts   inputBuffer を渡す、先行の表示、describeDrop
src/ui/screens.ts      スト6 の注記
docs/manual-checks.md  10 を足す
tests/commands.test.ts スト6 の buttonWindow の期待値を直す
tests/combo.test.ts・tests/profiles.test.ts  先行入力のテストを足す
```
