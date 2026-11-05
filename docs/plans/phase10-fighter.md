# 第10段階: 棒人間と技のフレームメーター（1 段目: 自分のキャラだけ）

## 目的

- 練習画面の上に、横長の小さなステージを常に出し、入力どおりに動く棒人間を描く
- キャラ（キャミィ・ブリジット）を選んでいるときは、地上の通常技と一部の必殺技・超必殺技を出せる。出した技の「発生・持続・硬直」を、技のフレームメーターに色分けで出す
- 見た目は作りこまない（線だけの棒人間、単色の背景）
- 相手（ダミー）・当たり判定・有利不利・キャンセル・空中技は、2 段目で扱う

## 出典（2026-11-05 時点）

- FAT（Frame Assistant Tool）の公開データ（https://github.com/D4RKONION/FAT 、`src/js/constants/framedata/`）。スト6 は 2026-10-22、GG は 2026-06-14 の更新
- ライセンスは GPL-3.0 なので、ファイルは写さない。使う技の数字だけを手で書き、出典をコメントとクレジット画面に書く（フレーム数は事実の情報という考え。法的な判断ではない）
- FAT の「発生（startup）」は持続の 1 フレーム目を含む。全体 = 発生 + 持続 + 硬直 − 1 で、表の数はすべてこの式で FAT の全体と一致する
- このアプリでは「発生前」= 発生 − 1 フレーム、「持続」、「硬直」の 3 つの数で持つ

### キャミィ（スト6）

| 入力 | 発生前 | 持続 | 硬直 | FAT の全体 | 読み替え |
|---|---|---|---|---|---|
| 5LP | 3 | 3 | 7 | 13 | |
| 5MP | 5 | 4 | 13 | 22 | |
| 5HP | 7 | 3 | 20 | 30 | |
| 5LK | 4 | 3 | 10 | 17 | |
| 5MK | 7 | 3 | 18 | 28 | |
| 5HK | 10 | 3 | 21 | 34 | 硬直 `19(21)`。FAT の補足に「空振りは 21F」とある。相手がいないので空振りの値（レビュー後に直した） |
| 2LP | 3 | 2 | 8 | 13 | |
| 2MP | 6 | 3 | 17 | 26 | 硬直 `14(17)`。同上（空振りは 17F） |
| 2HP | 9 | 4 | 15 | 28 | |
| 2LK | 4 | 3 | 7 | 14 | |
| 2MK | 7 | 3 | 18 | 28 | |
| 2HK | 8 | 3 | 24 | 35 | |
| 236LK | 8 | 13 | 21 | 42 | |
| 236MK | 8 | 15 | 21 | 44 | |
| 236HK | 14 | 16 | 21 | 51 | 持続 `3(1)12` は途中に 1F の切れ目があるが、まとめて 16 とする |
| 623LK | 4 | 12 | 40 | 56 | 硬直 `24+16`（着地まで＋着地）を足す |
| 623MK | 5 | 12 | 41 | 58 | 同上 |
| 623HK | 6 | 12 | 44 | 62 | 同上 |
| 214LP | 20 | 4 | 16 | 40 | |
| 214MP | 23 | 4 | 16 | 43 | |
| 214HP | 27 | 4 | 17 | 48 | |
| 236236K（SA1） | 8 | 16 | 38 | 62 | 持続 `4*3*3*3*3`（多段）を足す |
| 214214P（SA2） | 12 | 9 | 37 | 58 | |
| 236236P（SA3） | 8 | 15 | 38 | 61 | |

- 入れない: Hooligan Combination（発生が 20〜40 で決まらない）、Cannon Strike（空中技）
- 歩き・ジャンプ: ジャンプは 45F（跳ぶ前 4・空中 38・着地 3）。歩きの速さは画面の都合で決める（FAT の値は単位が分からないので使わない）

### ブリジット（GG）

| 入力 | 発生前 | 持続 | 硬直 | FAT の全体 | 読み替え |
|---|---|---|---|---|---|
| 5P | 7 | 2 | 14 | 23 | |
| 5K | 5 | 5 | 9 | 19 | |
| 5S | 6 | 6 | 13 | 25 | このアプリは近S と遠S を分けないので、近S（c.S）の値 |
| 5HS | 10 | 5 | 29 | 44 | FAT の 5H |
| 5D | 19 | 3 | 26 | 48 | 溜めない場合（FAT の発生 `20~[28]` の 20） |
| 2P | 6 | 4 | 9 | 19 | |
| 2K | 4 | 3 | 11 | 18 | |
| 2S | 10 | 6 | 20 | 36 | 持続 `3,3` を足す |
| 2HS | 10 | 11 | 24 | 45 | FAT の 2H。持続 `2,2,3,4` を足す |
| 2D | 12 | 4 | 15 | 31 | |
| 236K | 9 | 25 | 9 | 43 | |
| 236S・236HS | 14 | 21 | 3 | 38 | |
| 623P | 8 | 12 | 39 | 59 | |
| 63214P | 26 | 2 | 28 | 56 | Rock the Baby。下の「入力の直し」 |
| 632146S | 10 | 45 | 47 | 102 | 発生 `9+2` を 11 とする |

- 入れない: 214S・214HS（持続が書かれていない）、214K（発生が決まらない）、j.236K（空中技）、632146HS（数が書かれていない）
- ジャンプ: 跳ぶ前 4F、全体 41F、着地 6F（FAT の stats）。空中は 41 − 4 − 6 = 31F とする（**推測**。全体に着地が入るかは書かれていない）

### 入力の直し（キャラのデータ）

Rock the Baby の入力を `632146P` から `63214P` に直す。dashfight（1 か所）は 632146P、FAT（2026-06 更新）は 63214P。FAT のほうが新しく、ほかの技の入力とも合っているので FAT に合わせる。GG_COMMANDS に 63214 はある。

## 外から見える形（API）

### 技のデータ（`src/core/frameData.ts`、新規）

```ts
export interface MoveFrames {
  /** 入力。例: '5LP'、'236LK'、'236S'。複数ボタンで同じ値なら別々に書く */
  input: string;
  startup: number;   // 発生前（攻撃が出る前のフレーム数）
  active: number;
  recovery: number;
}
export interface FighterData {
  characterId: string;
  jump: { prejump: number; air: number; landing: number };
  moves: readonly MoveFrames[];
}
export const FIGHTER_DATA: readonly FighterData[];
export function fighterDataFor(characterId: string): FighterData | undefined;
export function totalFrames(m: MoveFrames): number;   // startup + active + recovery
```

### 技を選ぶ（`src/core/fighter.ts`、新規）

```ts
/**
 * いまのフレーム（history の最後）でボタンが新しく押されたとき、出る技を選ぶ。なければ null。
 * 必殺技・超必殺技は、表記のルール（profile）で入力を読み、analyzeAttempt が成功したものを選ぶ。
 * 並べる順（先に当たったものを選ぶ）: 超必殺技（236236 など、方向の手が多いもの）→ 必殺技 → 通常技。
 * 通常技は、いまの方向が 1・2・3 なら 2X、それ以外（4・5・6）なら 5X。7・8・9（ジャンプ）は null
 */
export function selectMove(
  history: readonly FrameInput[],
  data: FighterData,
  character: CharacterData,
  rules: NotationRules,
): MoveFrames | null;
```

### キャラの状態（`src/core/fighter.ts`）

```ts
export type FighterPhase = 'idle' | 'crouch' | 'walkForward' | 'walkBack'
  | 'prejump' | 'air' | 'landing' | 'startup' | 'active' | 'recovery';
export interface FighterState {
  phase: FighterPhase;
  /** いまの段階の何フレーム目か（0 から） */
  frame: number;
  /** 出している技（startup・active・recovery のときだけ） */
  move: MoveFrames | null;
  /** 横の位置（0〜1。0.5 が真ん中） */
  x: number;
  /** ジャンプの向き（-1 後ろ、0 垂直、1 前） */
  jumpDir: -1 | 0 | 1;
  /** 動けない間に押された技（先行入力）。動けるようになった最初のフレームで出す */
  buffered: { move: MoveFrames; age: number } | null;
}
export const INITIAL_FIGHTER: FighterState;   // idle、x 0.3
/**
 * 1 フレーム進める。history の最後がいまのフレーム。
 * - 動ける（idle・crouch・walk）とき: 技が選ばれたら startup の 0 フレーム目へ。そうでなければ方向で idle・crouch・walk・prejump
 * - 技の途中: startup → active → recovery と進み、終わったら動ける状態へ
 * - 技の途中や着地中に選ばれた技は buffered に入れる。動けるようになるまでに age が inputBuffer を超えたら捨てる
 * - ジャンプ: prejump → air → landing。空中ではボタンを無視する（空中技は 2 段目）
 * - 歩きは 1 フレームに一定の量だけ x を動かし、0.05〜0.95 で止める
 */
export function stepFighter(
  state: FighterState,
  history: readonly FrameInput[],
  fighter: { data: FighterData; character: CharacterData } | null,
  rules: NotationRules,
  inputBuffer: number,
): FighterState;
```

- キャラなし（`fighter` が null）のときは、歩き・しゃがみ・ジャンプだけ（ジャンプはキャミィと同じ 4・38・3）。技は出さない

### 技のフレームメーター（`src/core/moveMeter.ts`、新規）

```ts
export type MoveMeterKind = 'free' | 'startup' | 'active' | 'recovery' | 'jump';
/** 状態からマスの種類。idle・crouch・walk は 'free'、prejump・air・landing は 'jump' */
export function meterKindOf(state: FighterState): MoveMeterKind;
export interface MoveMeterState { cells: readonly MoveMeterKind[]; frozen: boolean }
/**
 * 1 フレーム進める。技を出し始めたら帯を空にして積み始め、技が終わって 'free' になったら止める（次の技まで残す）。
 * 技を出していない間は何もしない（同じ state を返す）。長さは 120 マスまで
 */
export function stepMoveMeter(state: MoveMeterState, prev: FighterState, next: FighterState): MoveMeterState;
```

- 帯の下の文: `5LP — 発生 4F / 持続 3F / 硬直 7F / 全体 13F`（発生は FAT と同じ数え方で「発生前 + 1」を出す）。英語は `5LP — Startup 4F / Active 3F / Recovery 7F / Total 13F`

### 画面

- `src/ui/stageView.ts`（新規）: Canvas の横長ステージ（高さ 160px 程度、幅は画面いっぱい）。床の線と棒人間だけ
  - 棒人間の形: 立ち・しゃがみ・歩き（脚を交互に）・跳ぶ前（しゃがむ）・空中・着地・技（発生前は構え、持続は手か足を伸ばす（P 系は腕、K・S・HS・D 系は脚）、硬直は戻す途中）
  - 色は 2 色まで。向きは右向き固定（1P 側）
- `src/ui/moveMeterView.ts`（新規）: 技のフレームメーターの帯（発生は緑、持続は赤、硬直は青、ジャンプは灰）と、下の文。キャラなしのときは「キャラを選ぶと技のフレームが出ます」
- 置き場所: 練習画面のタブの上。入力のフレームメーターより上
- クレジット画面に「フレームデータ: FAT（https://github.com/D4RKONION/FAT）」を足す

### main.ts

- 1 フレームごとに `stepFighter`・`stepMoveMeter` を進め、描く。描くのは練習画面にいるときだけ
- 処理が止まったとき（stall）は、キャラを INITIAL_FIGHTER に戻す
- キャラやゲームを変えたとき、練習画面に入ったときも INITIAL_FIGHTER に戻す

## 受け入れ条件

1. `FIGHTER_DATA` が上の 2 つの表のとおり（入力・発生前・持続・硬直）。どの技も `totalFrames` が FAT の全体と同じ。ジャンプの数も表のとおり
2. キャラのデータの Rock the Baby の入力が `63214P`
3. `selectMove`
   - 5 で LP → 5LP、2 で LP → 2LP、3 で LK → 2LK、6 で HP → 5HP、9 で LP → null
   - 236 + LK → 236LK（通常技の 5LK ではない）。236236 + K → 236236K（236K ではない）
   - ボタンを押しっぱなしのフレームは null（新しく押したときだけ）
   - コマンドは成立したが、その技のデータがないとき（例: ブリジットの 214 + S）は、通常技（5S）に落とさず null（データのない技が出たことにする）。判定に使うコマンドは、そのキャラが持っている技だけ（キャラのデータ `characters.ts` の技と、フレームデータの技）。キャミィが [4]6 の形で 6 + LP を押しても、キャミィに溜め技はないので 5LP
4. `stepFighter`
   - 5LP: startup 3F → active 3F → recovery 7F の順に進み、合計 13F で idle に戻る
   - 技の途中に押した技は、動けるようになった最初のフレームで出る（残りが inputBuffer 以内のとき）。inputBuffer を超えて早く押したものは出ない
   - しゃがみ・歩き・ジャンプ（prejump 4 → air → landing）の段階の移り方。空中ではボタンを無視
   - 歩きで x が増減し、端で止まる
   - キャラなし（fighter が null）では技を出さない
5. `stepMoveMeter`: 技を出し始めたら空から積み、終わったら止まって残る。次の技で入れ替わる。技を出していない間は同じ state を返す。120 マスを超えたら古いほうを捨てる
6. 文: 日本語と英語で上の形
7. `npm test`・`npm run typecheck`・`npm run build`・`npx madge --circular --extensions ts src` がすべて終了コード 0。`src/` の文字列リテラルに日本語を書かない

画面（棒人間の形と動き、メーターの色、スマホ幅、処理の重さ）は `docs/manual-checks.md` の「15」に書く。

## テストのコマンド

- `npm test`・`npm run typecheck`・`npm run build`・`npx madge --circular --extensions ts src` がすべて終了コード 0

## 構成

```
src/core/frameData.ts     技のフレームデータ（新規）
src/core/fighter.ts       技を選ぶ・キャラの状態（新規）
src/core/moveMeter.ts     技のフレームメーター（新規）
src/core/characters.ts    Rock the Baby の入力（変更）
src/ui/stageView.ts       棒人間（新規）
src/ui/moveMeterView.ts   技のメーター（新規）
src/ui/screens.ts         クレジット（変更）
src/i18n/messages.ts      文（変更）
src/main.ts, src/ui/style.css（変更）
docs/manual-checks.md     15 を足す
tests/frameData.test.ts・tests/fighter.test.ts・tests/moveMeter.test.ts（新規）、tests/characters.test.ts（Rock the Baby）
```

## テストで決めた細部（test-writer の仮定を採用）

- 技の文は `msg(lang).moveMeterText(move: MoveFrames)`
- ボタンを押したフレームが startup の 0 フレーム目
- 先行入力の `age` は、押したフレームが 0 で、1 フレームごとに +1。最初に動けるフレームで `age <= inputBuffer` なら、そのフレームが startup の 0 フレーム目になる
- 歩きの x は、歩き始めのフレームから動く。前ジャンプは空中で x が増え、後ろジャンプは減り、垂直は変わらない
- 1・2・3 で crouch
- 技のメーターは、技の開始フレームから 1 マスずつ積み、free になるフレームではマスを足さずに止める。ジャンプではメーターは動かない
- コマンドが成立しない（手の間が遅い・ボタンが遅いなど）ときは、通常技を選ぶ

## 実装中に追記: 技名を選んだ言語で出す（ユーザーの要望）

- 帯の下の文を `技名 (入力) — 発生…` にする。`msg(lang).moveMeterText(name, move)`
- 技名は `moveDisplayName(move, character, rules, lang)`（`src/core/fighter.ts`）で作る
  - 必殺技・超必殺技: キャラのデータで、方向が同じでボタンを含む技の名前（日本語名がなければ英語名）。例: `スパイラルアロー (236LK)`、`Spiral Arrow (236LK)`
  - 通常技: 「立ち／しゃがみ」とボタン。スト6 の日本語は弱・中・強（`立ち弱P (5LP)`）、GG はボタン名のまま（`立ちHS (5HS)`）。英語は `Standing LP (5LP)`・`Crouching D (2D)`
- 文は技を出した瞬間に 1 回だけ作る（毎フレーム作らない）
