# 第15段階: コンボトライアルを「相手に当たってつながったか」で判定する

## 目的

コンボトライアルの判定を、入力のタイミングの窓（前の手から何フレーム後に入れたか）から、フレームメーターと同じキャラとダミーの動きで「次の技が、相手の硬直が切れる前に当たったか」に変える。成功した手には、押したタイミングが猶予の中のどこだったか（最速 +N F・猶予 W F）を出す。

## 決めたこと（開発者の回答）

- キャラを選んでいるときは、キャラのコンボも、読み込んだ JSON のレシピも、新しい判定にする。フレームデータで判定できない手を含むレシピと、キャラなしのサンプルは、今までどおり入力の窓で判定する
- コンボトライアルのタブを開いている間、相手は「ヒット」に固定する
- 成功した手に「最速 +N F（猶予 W F）」を出す

## 前提（このアプリの決め）

- キャラとダミーの動きは第13・14段階のまま（技は持続の 1 フレーム目に必ず当たる、ヒットストップ、キャンセルの窓、先行入力 `inputBuffer`）
- 「つながった」は、第13段階の `combo` と同じ: 技の持続の 1 フレーム目に、前のフレームの相手がヒット硬直（`hitstun`）で、残りが 1 より大きい
- 相手の反応のデータがない技（例: キャミィの 236HK）も、持続の 1 フレーム目に上の条件を満たせば「つながった」とする（相手は反応しないので、その技はレシピの最後の手でだけ使える）
- JSON の形（`window` が要ること）は変えない。新しい判定のときは `window` を使わない

## 判定のしかた

### レシピの手を技に決める（`resolveRecipe`）

キャラのフレームデータ（`FighterData`）で、レシピの手ごとに「その手に当たる技」の一覧を作る。

- 手が通常技（例: `5LP`・`2MK`・`5S`）: 技の入力の先頭の数字（5 か 2）が手の方向（`dirs`）に入っていて、技のボタンが手のボタンに入っている技
- 手がコマンド（例: `236HK`・`214P`）: 方向の表記（`notation`）が同じで、技のボタンが手のボタンに入っている技（スト6 の `P` は LP・MP・HP のどれでもよい）
- 次のどれかなら、そのレシピは新しい判定にできない（`null`。入力の窓で判定する）
  - 当たる技が 1 つもない手がある（例: `[4]6P`。キャミィ・ブリジットのデータにない）
  - 最後でない手に、ヒットで相手がヒット硬直にならない技がある（反応のデータがない技、ダウンする技。そのあとの手はつながらないため）

### 1 フレームごとの判定（`stepSimTrial`）

`main.ts` が毎フレーム `stepFighter`・`stepDummy` のあとに、そのフレームの動き（`SimFrame`）を渡す。

- **手が当たるフレーム**: キャラの技が持続の 1 フレーム目（`phase 'active'`・`frame 0`・`frozen` でない）で、その技が待っている手の一覧に入っている
- **1 手目**: 1 手目の技が当たるフレームで成功（挑戦が始まる）。レシピが 2 手以上なら、相手に当たった（`contact` がある）ときだけ（ダウン中の相手には始めない）。1 手だけのレシピは、そこで完走
- **2 手目から**（待っている手を k とする）:
  - 技が始まったフレームに、その技が手 k の一覧にない → **失敗: 違う技**（`wrong`）
  - 手 k の技が当たるフレームで、つながった → **成功**（最後の手なら完走）。つながらなかった → **失敗: 遅い**（`late`。何フレーム遅いか付き）
  - 手 k の技が始まる前に相手が free になった → **失敗**。そのあいだに手 k の技を押したのに、先行入力が古くなって消えていたら **早い**（`early`。あと何フレーム遅く押せばよいか付き）、そうでなければ **遅い**（`late`。フレーム数なし）
- 完走・失敗のあとは 1 手目を待つ状態に戻る

### タイミングの数字（最速 +N F・猶予 W F）

前の手（k − 1）が当たったフレームを c、その技のヒットストップを H、持続を A、当たったときの硬直を R（`contactRecovery ?? recovery`）、そのときの相手の硬直の長さを L とする。手 k の技の発生前を U とする。

- 相手が動けるようになるフレーム E = c + H + L。手 k の技が「つながる」最も遅い出始め: **最遅 = E − 1 − U**
- **キャンセルで出た**（`canceled`）とき: 最速 = c（前の手が当たったフレーム）、出せる最後 = min(c + H + A, 最遅)
- **目押し**（キャンセルでない）とき: 最速 = c + H + A + R（キャラが動けるようになるフレーム）、出せる最後 = 最遅
- **猶予 W** = 出せる最後 − 最速 + 1
- **N** = 押したフレーム − 最速。押したフレームは、手 k の技を出すボタンを押したフレーム（先行入力・キャンセルの予約で出たときは、その技が先行入力に入ったフレーム。動ける状態や窓の中で押してすぐ出たときは、出たフレーム）。最速より前に押した（先行入力）ときは N がマイナス
- **遅い**のフレーム数 = 出たフレーム − 出せる最後
- **早い**のフレーム数 = (最速 − `inputBuffer`) − 押したフレーム（目押しのとき）。手 k の技が前の手の技のキャンセル先（`cancels`）なら、(c + 1 − `inputBuffer`) − 押したフレーム（当たったあと最初のフレームに先行入力が届く、最も早い押しから数える。レビューの提案 1 で追加）。ただしその値が 0 以下（キャンセルの窓が閉じたあとの押し。目押しとして早すぎた）なら、目押しの式で数える

キャンセルの猶予は FAT の確認の猶予（第14段階の 1 + H + A）と同じ数になり、目押しの猶予は「有利 − 発生前」の、よく言われる「N フレームの目押し」と同じ数になる。

## 例（キャミィ、相手はヒット、`inputBuffer` = 4。1 手目のボタンを押したフレームを 0）

5LP は 3 で当たり、4〜12 が止まる。キャラが動けるのは 22、相手が動けるのは 27（第14段階の表）。

| レシピ | 押し方 | 結果 |
|---|---|---|
| 5LP → 5LP | 22 で 5LP | 成功、最速 +0F（猶予 2F）。目押し: 最速 22、最遅 = 27 − 1 − 3 = 23 |
| 5LP → 5LP | 23 で 5LP | 成功、+1F（猶予 2F） |
| 5LP → 5LP | 24 で 5LP | 失敗: 遅い（1F） |
| 5LP → 5LP | 18 で 5LP | 成功、N = −4（先行入力。22 に出る） |
| 5LP → 5LP | 17 で 5LP | 失敗: 早い（あと 1F 遅く）。先行入力が 22 で古くなって消え、27 で相手が free |
| 5LP → 5LP | 13 で 5LP | チェーン（キャンセル）で 13 に出る。成功、+10F（猶予 13F） |
| 5LP → 5LP | 8 で 5LP | チェーン、13 に出る。成功、+5F（猶予 13F） |
| 5LP → 5LP | 何も押さない | 27 で失敗: 遅い（フレーム数なし） |
| 5LP → 5LP | 13 で 5MP | 5MP はキャンセル先でないので先行入力に入るが、18 で古くなって消える（手 2 の技ではないので「早い」にはしない）。何も出ずに 27 で失敗: 遅い（フレーム数なし） |
| 5LP → 5LP | 20 で 5MP | 22 に 5MP が出て、失敗: 違う技 |
| 2MK → 623HK | 4 で 623HK を入れ終える | 17 に出て 23 で当たる。成功、−3（先行入力。猶予 13F）。最速 = 7、出せる最後 = min(7 + 9 + 3, 38 − 1 − 6) = 19 |
| 2MK → 623HK | 10 で入れ終える | 成功、+3F（猶予 13F） |
| 2MP → 214LP | 止まっている間（7〜17）に入れる | 18 に出て 38 で当たる。成功、猶予 13F。最速 = 6、出せる最後 = min(6 + 11 + 3, 39 − 1 − 20) = 18 |
| 2MP → 214LP | 19 で入れ終える | 19 に出て 39 で当たるが、つながらない。失敗: 遅い（1F） |
| 2HP → 2MP → 236HK（コンボ 2） | 2HP は 9 で当たる。2MP を 41 で押す | 2MP は目押しで成功、+0F（猶予 1F）。最速 = 9 + 13 + 4 + 15 = 41、最遅 = (9 + 13 + 26) − 1 − 6 = 41（有利 +7 − 発生 7 の「1F 目押し」）。42 で押すと 48 で当たり、失敗: 遅い（1F）。236HK を 2MP のヒットストップ中（48〜58）に入れると 59 に出て、反応のデータはないが、持続の 1 フレーム目（73）に相手がヒット硬直なので完走 |

ブリジット: 5S → 2S → 2HS → 236K（第14段階の例と同じく、それぞれ前の技のヒットストップ中に入れる）は完走。2S の猶予は 1 + 14 + 6 = 21F。

判定できないレシピ（入力の窓で判定）の例: キャミィで `[4]6P` を含む、`2HK` が最後でない（ダウンする）、`236HK` が最後でない（反応のデータがない）。

（テストを書く途中で直した: 最初の版は、2HP の発生前を 8、2MP の発生前を 5 と書き違えていた。データは 9 と 6）

## 外から見える形（API）

### 新規 `src/core/comboSim.ts`

```ts
/** 1 フレームのキャラと相手の動き（main.ts が stepFighter・stepDummy のあとに作る） */
export interface SimFrame {
  /** 通算フレーム番号 */
  frame: number;
  /** 前のフレームのキャラ */
  before: FighterState;
  /** このフレームのキャラ（stepDummy のあと） */
  after: FighterState;
  /** 前のフレームの相手 */
  dummyBefore: DummyState;
  /** このフレームの相手 */
  dummyAfter: DummyState;
  /** このフレームで当たったか（stepDummy の contact） */
  contact: Contact | null;
}

/** 技が手（parseStep の結果）に当たるか。決め方は「レシピの手を技に決める」のとおり */
export function moveMatchesStep(move: MoveFrames, input: StepInput, rules: NotationRules): boolean;

/** レシピの手ごとに、当たる技の一覧。新しい判定にできなければ null */
export function resolveRecipe(recipe: ComboRecipe, data: FighterData, rules: NotationRules): readonly (readonly MoveFrames[])[] | null;

export interface SimTiming {
  /** 押したフレーム − 最速（マイナスは先行入力） */
  offset: number;
  /** 猶予のフレーム数 */
  window: number;
}

export type SimTrialEvent =
  | { type: 'hit' | 'complete'; stepIndex: number; timing: SimTiming | null }
  | { type: 'drop'; stepIndex: number; reason: 'early' | 'late' | 'wrong'; frames: number | null };

export interface SimTrialState {
  /** 次に当てる手（0 なら挑戦していない） */
  readonly stepIndex: number;
  // ほかの項目は実装で決めてよい（テストは stepIndex と event だけを見る）
}

export function initialSimTrial(): SimTrialState;

/** 1 フレーム進める。moves は resolveRecipe の結果 */
export function stepSimTrial(
  state: SimTrialState,
  moves: readonly (readonly MoveFrames[])[],
  f: SimFrame,
  inputBuffer: number,
): { state: SimTrialState; event: SimTrialEvent | null };
```

- 1 手目の成功は `timing: null`。2 手目からは `timing` を付ける
- `drop` の `frames`: `late` は「遅い」のフレーム数（技が出ていなければ null）、`early` は「早い」のフレーム数（分からなければ null）、`wrong` は null

### コンボの画面（`src/ui/comboPanel.ts`）

- `ComboPanel.step(history, frame, sim)` に 3 つ目の引数 `sim: SimFrame | null` を足す（キャラがいないときなどは null）
- 選んでいるレシピが `resolveRecipe` で決まれば新しい判定、決まらなければ今の `stepTrial`（キャラなし、判定できない手を含むレシピ）
- 手の箱の下の文:
  - 挑戦の前: 1 手目は今までどおり `開始`、2 手目からは新しい判定なら `つなぐ`（`comboConnect`）、窓の判定なら今までどおり窓
  - 成功: 新しい判定なら `comboTiming(offset, window)`、窓の判定なら今までどおり
  - 失敗: 新しい判定の理由は下の文
- キャラを選んでいて、選んだレシピが窓の判定になるときは、状態表示に `comboWindowFallback` を出す
- 一覧の下の注記（`comboCharacterNote`）の文を変える

### メーターの切り替え（`src/ui/frameMeterView.ts`・`src/main.ts`）

- `FrameMeterView` に `setDummyLocked(locked: boolean)` を足す。true の間は切り替えのボタンを押せなくし（`disabled`）、「ヒット」を選んだ見た目にして、横に `dummyLockedCombo` を出す。false に戻すと、設定の切り替えの見た目に戻る
- `main.ts`: 相手の動き（`stepDummy`）と技の文の結果（`resultText`）は、コンボトライアルのタブなら `'hit'`、そうでなければ設定の `dummyMode` を使う。タブを切り替えたら、キャラ・相手・帯を最初に戻し（`resetFighter`）、`setDummyLocked` を呼ぶ。設定の `dummyMode` は変えない
- `main.ts`: 毎フレーム、`stepFighter`・`stepDummy` のあとに `SimFrame` を作り、コンボのタブなら `comboPanel.step(history, frame, sim)` を呼ぶ（今は相手の動きより前に呼んでいるので、順番を入れ替える）

### キャラのコンボ（`src/core/characters.ts`）

- キャミィのコンボ 1（2LK → 2LP → 623HK）の 2LP の `join` を `'cancel'` にする（2LK のヒット +3 と 2LP の発生 4 では目押しにならない。チェーン）
- `LOOSE_WINDOWS` の説明を「窓の判定になったときに使う仮の値」に直す

### 文（`src/i18n/messages.ts`、日本語と英語）

- `comboTiming: (offset: number, window: number) => string`: offset が 0 以上なら `最速 +{offset}F（猶予 {window}F）` / `+{offset}F from earliest (window {window}F)`。マイナスなら `先行入力 {−offset}F 前（猶予 {window}F）` / `Buffered {−offset}F early (window {window}F)`
- `dropLateBy: (frames: number) => string`: `遅い（{frames}F 遅い）` / `Too late ({frames}F late)`
- `dropLateRecovered`: `遅い（相手が動けるようになった）` / `Too late (the opponent recovered)`
- `dropEarlyLost`: `早い（先行入力の前に押して、入力が消えた）` / `Too early (pressed before the input buffer, the input was lost)`（`early` で frames が null のとき。frames があれば今の `dropEarly(frames)`）
- `comboConnect`: `つなぐ` / `Connect`
- `comboWindowFallback`: `このレシピは、フレームデータで判定できない手を含むので、入力のタイミングの窓で判定します` / `This recipe has steps the frame data cannot judge, so it is judged by input timing windows`
- `comboCharacterNote` を `キャラを選んでいるときは、相手に当たってつながったかで判定します（相手はヒットに固定）` / `With a character selected, steps are judged by whether they hit and combo (the opponent is fixed to Hit)` に変える
- `dummyLockedCombo`: `コンボトライアル中はヒットに固定` / `Fixed to Hit during combo trials`
- i18n のテストの `SPECIAL_ARGS` に、`comboTiming` のマイナスの引数など、必要なものを足す

## 受け入れ条件

1. `moveMatchesStep`・`resolveRecipe`: 上の決め方のとおり。キャミィのコンボ 1〜3 とブリジットのコンボは決まる（null でない）。`[4]6P` を含むレシピ、最後でない手に 2HK（ダウン）・236HK（反応のデータなし）があるレシピは null。`236P` の手には 236LP・236MP・236HP の技があれば当たる（スト6 の `P`）
2. 上の「例」の表のとおりの `event`（種類・`stepIndex`・`timing`・`reason`・`frames`）になる。本物の `stepFighter`・`stepDummy` で進めて確かめる
3. 1 手目: 当たるまで挑戦は始まらない（押しただけ・ダウン中の相手に当てたときは `stepIndex` 0 のまま）。完走・失敗のあとは `stepIndex` 0
4. キャミィのコンボ 1（2LK → 2LP → 623HK）の 2 手目の `join` が `'cancel'`
5. 画面: キャラを選んだコンボのタブで、手の箱に `つなぐ`、成功で `最速 +NF（猶予 WF）`、失敗の理由、窓の判定のレシピで `comboWindowFallback`、メーターの切り替えが押せず「ヒット」で `コンボトライアル中はヒットに固定`。コマンド練習のタブに戻すと、切り替えが設定どおりに戻る（ヘッドレスの Chrome で確かめる）
6. `npm test`・`npm run typecheck`・`npm run build`・`npx madge --circular --extensions ts src` がすべて終了コード 0

今までのテスト（`stepTrial` の窓の判定など）は、窓の判定を残すので変えない。`comboCharacterNote` の文を見ているテストがあれば、新しい文に合わせて直す。

実機との比べ（目押しの猶予の数字が実機の感覚と合うか、など）は `docs/manual-checks.md` の「20」に書く。

## テストのコマンド

- `npm test`・`npm run typecheck`・`npm run build`・`npx madge --circular --extensions ts src` がすべて終了コード 0

## 実装中に追記

- 「押したフレーム」は、手の技が出始めたフレームで決める。直前のフレームの予約（`cancelTo`）か、まだ生きている先行入力（年齢 + 1 が `inputBuffer` 以下）から出たときだけ、先行入力に入ったフレームを使い、それ以外は出始めのフレーム（レビューの要修正 2 件。連打のチェーン、押し直し、消えかけの先行入力で数字がずれていた）
- 自分で決めた細部: キャラがいないときは `SimFrame` を作らない。「早い」の数が 0 以下になるときは `frames: null`（`dropEarlyLost` の文）
- （レビューの提案 1）キャンセル先の手の「早い」の数え方を足した（2MP → 214LP で「あと 28F 遅く」と出ていたのが「あと 1F 遅く」になる）
- 選ばなかった提案: 「遅い」で失敗した当たりが 1 手目の技でも、そこから新しい挑戦を始めない（今のまま）。新しい判定の 1 手目の `'OK'` を `describeHit` と同じ書き方にそろえる

## 構成

```
src/core/comboSim.ts      新しい判定（新規）
src/core/characters.ts    コンボ 1 の join・LOOSE_WINDOWS の説明（変更）
src/ui/comboPanel.ts      新しい判定と窓の判定の切り替え・文（変更）
src/ui/frameMeterView.ts  setDummyLocked（変更）
src/main.ts               SimFrame・相手の固定・呼ぶ順番（変更）
src/i18n/messages.ts      文（変更）
docs/manual-checks.md     20 を足す
tests/                    comboSim（新規）・characters・i18n
```
