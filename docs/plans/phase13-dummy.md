# 第13段階: 相手のダミー（ヒット・ガード硬直と有利フレーム）

## 目的

フレームメーターに相手の段を足し、技が当たったときの相手の硬直（黄）・ダウン（紫）と、有利・不利のフレーム数を出す。目押し（硬直が終わってから次の技を出してつなぐこと）がつながったかも分かるようにする。キャンセルは次の段階。

## 決めたこと（開発者の回答）

- 相手が反応する技: FAT の数字が 1 つに決まる技だけ。決まらない技は今までどおり空振り扱いにして、文で知らせる
- ヒットとガードを切り替えられる
- GG（ブリジット）も入れる。GG の FAT には硬直の長さがないので、有利の数字から計算する（推測を含む）
- キャンセルは次の段階に分ける（今回は目押しだけ）

## 前提（このアプリの決め）

- 相手はその場に立っているだけの的。距離は考えず、技は**持続の 1 フレーム目に必ず当たる**（今は位置を持っていないため）
- ヒットストップ（当たった瞬間に画面が止まる時間）は数えない（フレームデータはふつうこれを除いて書かれている）
- 1 つの技が当たるのは 1 回（持続の 1 フレーム目だけ）。多段の技も 1 回として扱う（有利の数字は FAT のとおりになる）
- 相手がダウン中は当たらない（空振り）

## 調べたこと（FAT、確認日 2026-11-05）

出典は前と同じ FAT（https://github.com/D4RKONION/FAT の `src/js/constants/framedata/`）。数字だけを手で写す。

- スト6 の技には `onHit`（ヒット時の有利）・`onBlock`（ガード時の有利）・`hitstun`（ヒット硬直）・`blockstun`（ガード硬直）がある
- 「持続の 1 フレーム目に当たったとき、有利 = 相手の硬直 − (持続 + 硬直)」が、キャミィの数字の入った技すべてで成り立つ（例: 5LP は 15 − (3 + 7) = +5）。ただし 623MK・623HK のガードだけ合わない（ガードされると着地が早まる技と考えられる。推測）
- ダウンする技は `KD +38` のように、ダウン後の有利だけが書かれている（`HKD` はハードダウン。このアプリでは同じダウンとして扱う）
- 括弧つき（`KD +26(48)`、`-24(-22)` など）は、条件で数字が変わる。1 つに決まらないので入れない
- GG は `onHit`・`onBlock` だけで、硬直の長さはない。ブリジットの 236S・236HS は飛び道具（`projectile`）で、持続の 1 フレーム目に当たるとは限らないので入れない
- 当たったときの硬直が空振りと違う技（キャミィ 5HK `19(21)`、2MP `14(17)`。括弧の中が空振り）は、当たったら外の値を使う

## 相手の反応の長さ（計算のしかた）

当たったフレームを t とする。相手はフレーム t から L フレームの間、硬直（またはダウン）で、t + L から動ける。キャラは t から持続 A と硬直 R（当たったときの値）が残り、t + A + R から動ける。なので、

**L = 有利 + A + R**

とすれば、メーターで測る有利（相手が動けるフレーム − キャラが動けるフレーム）は FAT の数字とぴったり同じになる。スト6 ではこの L が FAT の `hitstun`・`blockstun` と同じになる（623MK・623HK のガードを除く）。GG の L は計算で出した値で、実際のゲームの硬直の長さとは違うことがある（推測）。

## 入れる数字

`ヒット` の `KD n` はダウン（ダウン後の有利 n）。`—` は入れない（その切り替えでは空振り扱い）。

### キャミィ（スト6）

| 技 | ヒット | ガード | 当たったときの硬直 |
|---|---|---|---|
| 5LP | +5 | -2 | |
| 5MP | +6 | -1 | |
| 5HP | +2 | -3 | |
| 5LK | +2 | -3 | |
| 5MK | +3 | -4 | |
| 5HK | +2 | -3 | 19（空振りは 21） |
| 2LP | +5 | -2 | |
| 2MP | +5 | -2 | 14（空振りは 17） |
| 2HP | +7 | +1 | |
| 2LK | +3 | -2 | |
| 2MK | +1 | -5 | |
| 2HK | KD 38 | -10 | |
| 236LK・236MK・236HK | — | — | （括弧つき） |
| 623LK | KD 20 | -36 | |
| 623MK | KD 21 | -36 | |
| 623HK | KD 22 | -36 | |
| 214LP | +2 | -3 | |
| 214MP | +3 | -2 | |
| 214HP | +5 | +3 | |
| 236236K | KD 10 | — | （ガードは括弧つき） |
| 214214P | KD 12（HKD） | — | （ガードは括弧つき） |
| 236236P | KD 17（HKD） | — | （ガードは括弧つき） |

### ブリジット（GG）

| 技（FAT の名前） | ヒット | ガード |
|---|---|---|
| 5P | -3 | -6 |
| 5K | +1 | -2 |
| 5S（c.S） | +13 | +1 |
| 5HS（5H） | -14 | -17 |
| 5D | ±0 | -15（溜めない場合。`0[KD]`・`-15[-10]` の括弧の外） |
| 2P | ±0 | -3 |
| 2K | +1 | -2 |
| 2S | -6 | -9 |
| 2HS（2H） | -15 | -18 |
| 2D | —（`HKD` で数字なし） | -6 |
| 236K | -17 | -20 |
| 236S・236HS | — | —（飛び道具） |
| 623P | —（`KD` で数字なし） | -28 |
| 63214P | — | — |
| 632146S | —（`HKD` で数字なし） | -29 |

## 外から見える形（API）

### 技のデータ（`src/core/frameData.ts`）

```ts
/** ヒット時の有利。数ならその場で硬直、knockdown ならダウン（ダウン後の有利） */
export type HitAdvantage = number | { readonly knockdown: number };

export interface MoveFrames {
  input: string; startup: number; active: number; recovery: number;
  /** 当たったとき（ヒット・ガード）の硬直。空振りと違う技だけ */
  contactRecovery?: number;
  /** ヒット時の有利（FAT の onHit）。数字が 1 つに決まらない技は書かない */
  onHit?: HitAdvantage;
  /** ガード時の有利（FAT の onBlock）。同上 */
  onBlock?: number;
}

export type DummyMode = 'hit' | 'block';

export interface Reaction {
  kind: 'hitstun' | 'blockstun' | 'down';
  /** 相手が固まる（倒れている）フレーム数 L = 有利 + 持続 + 当たったときの硬直 */
  frames: number;
  /** 有利フレーム（FAT の数字。ダウンはダウン後の有利） */
  advantage: number;
}

/** その切り替えで技が当たったときの相手の反応。データがなければ null */
export function contactReaction(move: MoveFrames, mode: DummyMode): Reaction | null;
```

### 相手（新規 `src/core/dummy.ts`）

```ts
export type DummyPhase = 'free' | 'hitstun' | 'blockstun' | 'down';
export interface DummyState {
  phase: DummyPhase;
  /** このフレームを含めて、あと何フレーム続くか（free は 0） */
  remaining: number;
}
export const INITIAL_DUMMY: DummyState; // { phase: 'free', remaining: 0 }

export interface Contact {
  kind: 'hit' | 'block';
  knockdown: boolean;
  /** 相手の硬直が続いている間に当たった（ヒットならコンボ、ガードなら連続ガード） */
  combo: boolean;
  /** その技の有利（Reaction.advantage） */
  advantage: number;
}

/**
 * 1 フレーム進める。dummy は前のフレームの相手、fighter はこのフレームのキャラ（stepFighter のあと）。
 * - fighter が持続の 1 フレーム目（phase 'active' かつ frame 0）で、相手がダウン中でなく、contactReaction(技, mode) が
 *   null でなければ当たる: 相手は { phase: 反応の種類, remaining: frames }。fighter には contact の印を付けて返す。
 *   combo は、前のフレームの相手が同じ種類の硬直（hit なら hitstun、block なら blockstun）で remaining > 1 のとき true
 * - 当たらなければ: 相手の remaining を 1 減らし、0 になったら { phase: 'free', remaining: 0 }。free ならそのまま
 * - 変わらないときは同じ dummy・同じ fighter を返す
 */
export function stepDummy(dummy: DummyState, fighter: FighterState, mode: DummyMode):
  { dummy: DummyState; fighter: FighterState; contact: Contact | null };
```

### キャラ（`src/core/fighter.ts`）

- `FighterState` に `contact?: true`（いまの技が相手に当たった）を足す。新しい技を出したら消える
- 硬直（recovery）の長さは、`contact` があり `move.contactRecovery` があればそれ、なければ `move.recovery`

### フレームメーター（`src/core/frameMeter.ts`）

- `FrameMeterCell` に `opponent?: 'hitstun' | 'blockstun' | 'down'`（相手が free のときは付けない）と `contact?: Contact`（そのフレームで当たった）を足す
- `stepFrameMeter(state, prev, next, history, opponent?)` に 5 つ目の引数 `opponent?: { dummy: DummyState; contact: Contact | null }` を足す。省いたら相手はずっと free（今までのテストはそのまま通る）
  - 先頭に付ける入力だけの部分の相手は free
  - 当たったら、そのマスに `contact`、帯の `starts` の最後（当たった技）に `contact` を付ける（`starts` の要素は `{ index, move, contact? }`）
  - 区切り（30F）は「キャラが 'free'・ボタンを押していない・相手も free」が続いたフレーム数で数える
- `FrameMeterState` に `advantage: number | null` を足す。帯の中で最後に当たった技について、当たったあと「キャラが持続・硬直でなくなった最初のフレーム」と「相手が free になった最初のフレーム」がどちらも来たら、`相手の方 − キャラの方` を入れる。新しく当たったら、その技の分が決まるまで前の値のまま。新しい帯では null。`EMPTY_FRAME_METER` は `advantage: null`

### 有利の数の書き方（`src/core/dummy.ts`）

```ts
/** 有利の数を符号つきにする。5 → '+5'、-2 → '-2'、0 → '±0'（帯の右端と文で使う。言語によらない） */
export function formatAdvantage(n: number): string;
```

### 文（`src/i18n/messages.ts`、日本語と英語）

- `dummyLabel`（相手 / Opponent）・`dummyHit`（ヒット / Hit）・`dummyBlock`（ガード / Block）・`noReactionData`（相手の反応のデータなし / No reaction data）: 文字列
- `contactText: (c: Contact) => string`: 当たり方の文。日本語 `ヒット +5F`・`ヒット（つながった） +5F`・`ダウン +38F`・`ガード -2F`・`ガード（連続ガード） -2F`、英語 `Hit +5F`・`Hit (combo) +5F`・`Knockdown +38F`・`Block -2F`・`Block (blockstring) -2F`。数は `formatAdvantage` + `F`（0 は `±0F`）。ダウンで `combo` のときは `ダウン（つながった） +38F` / `Knockdown (combo) +38F`
- `frameMeterLegend` に「黄: 相手の硬直　紫: 相手のダウン」/ `Yellow: opponent stun  Purple: opponent knockdown` を足す
- i18n のテストの `SPECIAL_ARGS` に `contactText` の代表の引数（`Contact` の値）を足す

### 設定（`src/core/settings.ts`）

- `Settings` に `dummyMode: DummyMode`（既定 `'hit'`）。読めない値は `'hit'`。保存にも入れる

### 画面

- フレームメーターの見出しの横に「相手: [ヒット] [ガード]」の切り替え。押すと設定に保存し、キャラ・相手・帯を最初に戻す（押したらフォーカスを外す）
- 帯は 3 段: キャラの状態（今の上の段）・相手の状態・入力（今の下の段）。相手の段は、free = 暗い灰、硬直（ヒット・ガード）= 黄、ダウン = 紫
- 帯の右端に有利の数（`+5`・`-2`・`±0`）。`advantage` が null なら出さない。プラスは緑、マイナスは赤
- 技の文の後ろに結果: `/ ヒット +5F`、`/ ヒット（つながった） +5F`、`/ ダウン +38F`、`/ ガード -2F`、`/ ガード（連続ガード） -2F`。いまの切り替えで反応のデータがない技は `/ 相手の反応のデータなし`。英語は `Hit +5F`・`Hit (combo) +5F`・`Knockdown +38F`・`Block -2F`・`Block (blockstring) -2F`・`No reaction data`。0 は `±0F`
- 凡例に「黄: 相手の硬直　紫: 相手のダウン」（英語も）を足す

## 受け入れ条件

1. `contactReaction` が上の表のとおり。スト6 のキャミィは、L が FAT の `hitstun`・`blockstun` と同じ（623MK・623HK のガードを除く。テストに FAT の値を書いて確かめる）。表の `—` は null。すべての L は 1 以上
2. 相手: キャミィの 5LP（ヒット）で、持続の 1 フレーム目から 15 フレーム hitstun、そのあと free。ガードなら 8 フレーム blockstun。2HK（ヒット）は 65 フレーム down。ダウン中に当てても当たらない。データのない技（236LK）は当たらない
3. 5HK はヒット・ガードで硬直 19、空振り（相手がダウン中など）で 21
4. 有利: キャミィで 5LP を当てて何もしないと、帯の `advantage` が +5（ガードなら -2）。2HK（ヒット）は +38、623LK（ガード）は -36。ブリジットの 5S（ヒット）は +13
5. 目押し: 5LP（ヒット）のあと、動けるようになった最初のフレームか、その次のフレームに 5LP を押すと、2 回目が `combo: true`（つながった）。2 フレーム空けて 3 フレーム目に押すと `combo: false`（5LP は +5 で発生 4 なので、つながる猶予は 2 フレーム）。硬直中に押した先行入力（動けるようになった最初のフレームに出る）も `combo: true`。ガードでも同じく連続ガードが分かる
6. 帯の区切りは、相手が硬直・ダウンの間は始まらない（2HK のダウン中は止まらない）
7. 設定の `dummyMode` が読み書きできる（読めない値は 'hit'）
8. 画面: 切り替え・3 段の帯・右端の有利・技の文の結果・凡例が上のとおり（ヘッドレスの Chrome で確かめる）
9. `npm test`・`npm run typecheck`・`npm run build`・`npx madge --circular --extensions ts src` がすべて終了コード 0

実機との比べ（キャミィの目押しの猶予、ブリジットの有利）は `docs/manual-checks.md` の「18」に書く。

## テストのコマンド

- `npm test`・`npm run typecheck`・`npm run build`・`npx madge --circular --extensions ts src` がすべて終了コード 0

## 実装中に追記

- `Contact` と `formatAdvantage` は、新しい `src/core/contact.ts` に置き、`src/core/dummy.ts` から再エクスポートする（`messages.ts` が `dummy.ts` を読むと、`dummy.ts` → `fighter.ts` → `messages.ts` の循環参照になるため）。テストは `dummy.ts` から読む
- `contact` の印は、新しい技を出すときと、動けるようになるとき（技の終わり）に外す
- `advantage` は、帯の長さの上限で古いマスを捨てる前のマスで計算する。帯が止まっても値は残る
- テストで決めた細部: 実データ（キャミィ）では連続ガードを作れない（5LP のガードが -2 のため）。連続ガードが `combo: true` になることは、ガードの有利だけを変えたデータで確かめた。`advantage` が決まるのは、キャラと相手の「動けるようになった最初のフレーム」の遅いほう（5LP ヒットなら当たってから 15 フレーム目）

- （レビューの提案 1）技の文の行は、帯の `starts` が変わったら作り直す（新しい帯を前と同じ技で始めたとき、文の並びが同じでも、前の帯の結果を残さないため）
- 選ばなかった提案: 当たってから有利が決まるまでが 120 マス未満かをデータのテストで守る（今の最長は 92）、相手の段の黄と押したボタンの黄を見分けやすくする、63214P を入れない理由のコメントを事実（FAT はヒットが `HKD` で数字なし、ガードは値なし）と推測に分ける

## 構成

```
src/core/frameData.ts   有利の数字・contactReaction（変更）
src/core/dummy.ts       相手（新規）
src/core/contact.ts     Contact と formatAdvantage（新規。dummy.ts から再エクスポート）
src/core/fighter.ts     contact と当たったときの硬直（変更）
src/core/frameMeter.ts  相手の段・advantage（変更）
src/core/settings.ts    dummyMode（変更）
src/ui/frameMeterView.ts 3 段・右端の有利・切り替え（変更）
src/main.ts             相手を進める・切り替え（変更）
src/i18n/messages.ts    文（変更）
src/ui/style.css        色（変更）
docs/manual-checks.md   18 を足す
tests/                  frameData・dummy（新規）・fighter・frameMeter・settings・i18n
```
