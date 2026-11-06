# 第20段階: ブリジットの近S・遠S と、基本コンボ

## 目的

ブリジット（GG）の 5S を、近S（`c.S`）と遠S（`f.S`）に分ける。アプリは位置（距離）を持たないので、「距離: 近い／遠い」の切り替えで、S を押したときにどちらが出るかを決める。あわせて、近S・遠S を使う基本コンボを足す。

## 決めたこと（開発者の回答）

- 距離の切り替えを、フレームメーターの「相手」の切り替えの横に置く。コンボのタブでは、レシピに合わせて自動
- 基本コンボを 3〜5 個足す

## 調べたこと（確認日 2026-11-06）

- FAT（GG の更新 2026-06-14）: c.S は発生 7・持続 6・硬直 13、ヒット +13・ガード +1、攻撃レベル 3、キャンセル `j`・`d`・`sp`・`su`、ガトリング 6P・6K・f.S・2S・5H・2H・6H・5D・2D（今の 5S の値と同じ）。f.S は発生 10・持続 5・硬直 18、ヒット -6・ガード -9、攻撃レベル 2、キャンセル `sp`・`su`、ガトリング 5H・2H
- Dustloop の Bridget/Combos（ページは読み込みを断られた。検索結果の抜粋で確認）: 中央の基本ルートは `c.S > f.S//2S > 5H/2H(H) > 236K(~K)`

## 決め

### データ（`src/core/frameData.ts`）

- ブリジットの `5S` を `c.S`（入力 `'c.S'`。数字は今の 5S と同じ）にし、`f.S` を足す: 発生前 9・持続 5・硬直 18、ヒット -6・ガード -9、ヒットストップ 13（攻撃レベル 2。第14段階の推測の表）、キャンセル先: 5HS・2HS・必殺技・SA
- c.S のキャンセル先に f.S を足す（FAT のガトリングにある。今まではデータになかった）
- 今まで `'5S'` を参照していた所（キャンセル先の一覧など）は `'c.S'` に直す

### 表記（`src/core/notation.ts`）

- `c.S`・`f.S` を読む。`StepInput` の normal に `range?: 'close' | 'far'` を足す（c は close、f は far）。方向は 5（立ち）
- `5S` は今までどおり読み、range なし（近S・遠S のどちらにも当たる）
- `c.`・`f.` は GG のボタン S にだけ付けられる（ほかのボタン・SF6 では読めない、の失敗の文は今までと同じ）

### 距離（`src/core/settings.ts`・`src/core/fighter.ts`）

- `Settings` に `distance: 'close' | 'far'`（既定 `'close'`）。読めない値は `'close'`。保存にも入れる
- `selectMove` と `stepFighter` に、距離を渡す（引数を足す。形は任せるが、渡さなければ `'close'`）。立ちの S（方向 4・5・6 で S）を押したとき、近いなら `c.S`、遠いなら `f.S` を選ぶ。データに `c.S`・`f.S` がないキャラ（キャミィ）では今までどおり `5X`
- キャンセル・ガトリング・先行入力・派生など、選ばれた技のあとの決まりは今までと同じ

### 画面（`src/ui/frameMeterView.ts`・`src/main.ts`）

- メーターの見出しの「相手:」の切り替えの横に「距離: [近い] [遠い]」。押すと設定に保存し、キャラ・相手・帯を最初に戻す（相手の切り替えと同じ）。データに `c.S`・`f.S` があるキャラのときだけ出す
- コンボのタブでは、距離の切り替えを押せなくし、「コンボトライアル中はレシピに合わせる」と出す。距離は、次に当てる手が `c.S` なら近い、`f.S` なら遠い、それ以外なら前の値のまま（1 手目の前は、レシピの最初の `c.S`・`f.S` の手に合わせる。なければ近い）。タブを戻すと、設定の距離に戻る
- （レビューの要修正 1 で追加）コンボのタブの距離は、「次に押す S がどの手のためか」で決める。待っている手 k の技を、キャラがすでに出していて（まだ当たっていない）なら手 k + 1、そうでなければ手 k。新しい関数（`src/core/comboDistance.ts`）:
  ```ts
  /** レシピの手 steps で、次に押すのが手 next のためのときの距離。next の手が c.S なら 'close'、f.S なら 'far'、それ以外は prev。next が 0 なら、レシピの最初の c.S・f.S の手に合わせる（なければ 'close'） */
  export function recipeDistance(steps: readonly StepInput[], next: number, prev: Distance): Distance;
  ```
  `comboPanel` は、新しい判定なら「キャラの今の技が手 stepIndex の技の一覧に入っているか」で next を決めて呼ぶ。窓の判定のレシピは stepIndex をそのまま next にする。例: combo-3 で c.S を 0 で押し、2 手目の S を 4（c.S の発生中）に押すと、先行入力は f.S になり、21 から f.S が出る
- 技の名前（`moveDisplayName`）: `c.S` は `近S (c.S)` / `Close S (c.S)`、`f.S` は `遠S (f.S)` / `Far S (f.S)`

### コンボ（`src/core/characters.ts`、出典は Dustloop の基本ルート）

| id | 手 | つなぎ |
|---|---|---|
| bridget-combo-1 | c.S > 2S > 2HS > 236K | すべて cancel（今の 5S を c.S に直す） |
| bridget-combo-2 | c.S > 2S > 5HS > 236K | すべて cancel |
| bridget-combo-3 | c.S > f.S > 5HS > 236K | すべて cancel |
| bridget-combo-4 | c.S > f.S > 2HS > 236K | すべて cancel |
| bridget-combo-5 | c.S > 2S > 2HS > 236K~K | すべて cancel（最後は派生の発射） |

- 名前は英語で手を並べたもの（今のコンボと同じ）。`source` は「Dustloop の基本ルート（c.S > f.S//2S > 5H/2H > 236K(~K)。検索結果の抜粋で確認）」
- 手で計算した例: combo-3 は、c.S が 6 で当たり 7〜20 が止まる → f.S は 21 から出て 30 で当たる（c.S の相手の残り 23）→ 31〜43 が止まり、5HS は 44 から出て 54 で当たる（残り 7）→ 55〜68 が止まり、236K は 69 から出て 78 で当たる（残り 11）。すべてつながる

### 文（`src/i18n/messages.ts`、日英）

- `distanceLabel`: `距離` / `Distance`、`distanceClose`: `近い` / `Close`、`distanceFar`: `遠い` / `Far`
- `distanceLockedCombo`: `コンボトライアル中はレシピに合わせる` / `Follows the recipe during combo trials`
- 近S・遠S の名前（上の `moveDisplayName`）

## 受け入れ条件

1. データ: ブリジットに `c.S`（今の 5S の値）と `f.S`（上の値）がある。`5S` はない。c.S のキャンセル先に f.S、f.S のキャンセル先が 5HS・2HS・必殺技・SA
2. 表記: `parseStep('c.S')`・`parseStep('f.S')` が range つきの normal。`5S` は range なし。SF6 の `c.LP` などは失敗
3. 距離: ブリジットで 5 + S → 近いなら c.S、遠いなら f.S。2 + S は距離によらず 2S。キャミィは今までどおり
4. 設定: `distance` が読み書きできる（読めない値は 'close'）
5. コンボ: 上の 5 つがキャラのコンボにあり、新しい判定で決まる（`resolveRecipe` が null でない）。combo-3 を上の例のとおり押すと完走する（コンボのタブの自動の距離で、2 手目の S が f.S になる。テストでは、距離を手に合わせて渡して確かめる）
6. 画面: 距離の切り替え・コンボのタブでの固定・技の名前（ヘッドレスの Chrome で確かめる）
7. `npm test`・`npm run typecheck`・`npm run build`・`npx madge --circular --extensions ts src` がすべて終了コード 0

今までのテストのうち、ブリジットの `5S` を使っているものは、`c.S` に直す（数字は同じ）。

実機との比べ（遠S のヒットストップ 13 は推測の表）は `docs/manual-checks.md` の「24」に書く。

## テストのコマンド

- `npm test`・`npm run typecheck`・`npm run build`・`npx madge --circular --extensions ts src` がすべて終了コード 0

## 構成

```
src/core/frameData.ts     c.S・f.S（変更）
src/core/notation.ts      c.S・f.S の表記（変更）
src/core/fighter.ts       距離で S を出し分ける（変更）
src/core/settings.ts      distance（変更）
src/core/characters.ts    コンボ（変更）
src/core/comboSim.ts      range つきの手（必要なら変更）
src/ui/frameMeterView.ts  距離の切り替え（変更）
src/main.ts               距離を渡す・コンボのタブの自動（変更）
src/i18n/messages.ts      文（変更）
docs/manual-checks.md     24 を足す
tests/                    frameData・notation・fighter・settings・characters・comboSim・i18n
```

## 実装中に追記

- テストの直し: settings のテストの期待と値に `distance` を足した（既定値の 1 行だけ直して、ほかの 11 件と型の確認が落ちていたため）
- 実装で決めた細部: 距離は `selectMove`・`stepFighter` の最後の省略できる引数。近S・遠S の名前は `rangedMoveName`。距離の切り替えの行は、相手の行と同じ見た目のクラスを使う
- （レビューの要修正 1）コンボのタブで、2 手目の S を c.S が当たる前に押すと f.S が出なかった。`recipeDistance`（`src/core/comboDistance.ts`）に移し、キャラが待っている手の技を出しているなら次の手で距離を決めるようにした。テストは本物の `recipeDistance` を呼ぶ形（レビューの提案 1）
- 選ばなかった提案: 距離の行の CSS のクラス名を、相手の行と分ける（今は見た目をそろえるために同じ。あとで相手の行だけ見た目を変えるときに分ける）
