# 第19段階: フレームデータのない技を入れたとき、メーターにその旨を出す

## 目的

コマンドは成立したのに、フレームデータがないためキャラが何も出さない技（例: ブリジットの 632146HS）を入れたとき、フレームメーターに「この技はフレームデータがないので、メーターに出ません」と出す。今は何も起きないので、壊れているように見える（開発者の報告、2026-11-06）。

## 決めたこと（開発者の回答）

- メーターに「データがない」と出す。あわせて、ほかの出典で数が見つかった技は入れる
- 調べた結果（2026-11-06）: FAT（2026-06-14 更新）は 632146H が発生 `9+1`・ガード +8 だけで持続・硬直がない。214S・214H は持続がない。214K は持続が `UL`（着地まで）。wikiwiki「ブリジット/コマンド技」（2026-10-01 更新）にも 3 つの技の発生・持続・硬直の数はない。Dustloop は読み込みを断られた。**今回入れられる技はない**

## 決め

- 「データのない技」: キャラのデータ（`CharacterData.moves`）にあり、そのコマンドが今のフレームで成立した（`selectMove` と同じ見方）のに、フレームデータ（`FighterData.moves`）に当たる技がない技。派生（`kind: 'followUp'`）は対象外
- 今のデータで当たる技: ブリジットの 214S・214HS（ストップ＆ダッシュ 214版）、214K（ローリング移動）、632146HS（帰ってきたキルマシーン）。キャミィの 214K（キャノンストライク、空中技）
- メーターの注記の行（今「キャラなし」の知らせを出している所）に、`meterNoData(name)` を出す。次に技が出る（帯に技が始まる）か、別のデータのない技を入れるまで出したまま。新しい帯になったら消す

## 外から見える形（API）

`src/core/fighter.ts`:

```ts
/**
 * いまのフレーム（history の最後）でボタンが新しく押され、キャラの技のコマンドが成立したのに、
 * フレームデータに当たる技がないとき、その技（MoveData）。そうでなければ null。派生の技は見ない
 */
export function noDataMove(
  history: readonly FrameInput[],
  data: FighterData,
  character: CharacterData,
  rules: NotationRules,
): MoveData | null;
```

`src/i18n/messages.ts`（日英）:

- `meterNoData: (name: string) => string`: `{name} はフレームデータがないので、メーターに出ません` / `{name} has no frame data, so it does not appear on the meter`

`src/ui/frameMeterView.ts`: `render` に注記の文を渡せるようにする（形は任せる）。`src/main.ts`: 毎フレーム `noDataMove` を調べ、当たれば注記を出す（名前は `moveToCommand` などで作る「名前 (入力)」）。

## 受け入れ条件

1. `noDataMove`: ブリジットで 632146 + HS → 帰ってきたキルマシーン、214 + S → ストップ＆ダッシュ（214版）、214 + K → ローリング移動。236 + K・5 + P・ボタンを押していないフレーム → null。キャミィで 214 + K → キャノンストライク（Cannon Strike）。キャミィで 236 + LP（フーリガン。今はデータがある）→ null
2. 画面: ブリジットで 632146HS を入れると、メーターの注記に `帰ってきたキルマシーン (632146HS) はフレームデータがないので、メーターに出ません` が出る。そのあと 5P を出すと消える（ヘッドレスの Chrome で確かめる）
3. `npm test`・`npm run typecheck`・`npm run build`・`npx madge --circular --extensions ts src` がすべて終了コード 0

## テストのコマンド

- `npm test`・`npm run typecheck`・`npm run build`・`npx madge --circular --extensions ts src` がすべて終了コード 0

## 構成

```
src/core/fighter.ts       noDataMove（変更）
src/ui/frameMeterView.ts  注記の文（変更）
src/main.ts               注記を出す・消す（変更）
src/i18n/messages.ts      meterNoData（変更）
tests/                    fighter・i18n
```

## 実装中に追記

- `frameMeterView.render` の第 3 引数を、キャラなしの真偽値から注記の文字列に変えた（キャラなしの案内も同じ行に出す）
- 注記は、帯の技の数が変わったとき・新しい帯になったとき・`resetFighter` で消える
- 差分が小さいので、レビューの役は呼ばず本体が確かめた。画面はヘッドレスの Chrome で、632146HS で注記が出て 5P で消えることを確かめた
