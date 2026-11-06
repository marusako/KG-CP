# 第16段階: コマンド練習で「出た技」を出す

## 目的

コマンド練習で、入力の成否（今の判定の文）に加えて、実際にキャラが出した技（または技が出なかったこと）を出す。「236K のつもりが 2MK が出た」「硬直中に押して、先行入力が切れて何も出なかった」が分かるようにする。

## 決めたこと（開発者の回答）

- 失敗のときだけでなく、成功のときも出た技を出す（入力は成功でも、技が出ないことがあるため）
- 技の途中（硬直中・ヒットストップ中）に押したときは、あとで分かった時点で出す（出た技、または先行入力が切れて出なかったこと）
- キャラなし（フレームデータがない）のときは、今までどおり入力の判定だけ

## 決め（このアプリの決め）

- 「試し」は、今の判定（`analyzeAttempt`）が結果を返したフレーム（選んだ技のボタンを押した瞬間）。そのフレームのキャラの動き（`stepFighter`・`stepDummy` のあと）で、出た技を決める
- そのフレームで技が始まった → **出た技**（すぐ）。キャンセルで始まったら「キャンセル」の印
- そのフレームで技が先行入力に入った（`after.buffered` の `age` が 0） → **待つ**。そのあと:
  - その技が始まった（直前のフレームの先行入力か予約から出た） → **出た技**（「先行入力」の印。キャンセルで出たら「キャンセル」の印）
  - その技が始まる前に、先行入力から消えた（古くなった・別の技で上書きされた） → **出なかった: 先行入力が切れた**
- そのフレームで何も選ばれなかった:
  - 空中・跳ぶ前（`prejump`・`air`） → **出なかった: 空中**
  - それ以外 → **出なかった**
- 待っている間に次の試しが来たら、前の試しは捨てる（画面は新しい試しを出す）
- （レビューの提案 2 で追加）試しのフレームに技が始まっても、それが直前のフレームの予約（`before.cancelTo`）から出たものなら、この試しの前に入れた技なので「出た技」にしない。この試しの入力は予約の技に置き換わって消えたので、`none`・`'bufferLost'`
- 出た技が、選んでいる技（コマンド練習で選んだ技）と違うときは「選んだ技と違う」の印を付ける。同じかは、技の入力を読んだコマンドの表記（`notation`）が同じで、技のボタンが選んだ技のボタンに入っているか
- 選んでいる技に、フレームデータの技が 1 つもないとき（例: ブリジットの 214S）は、出た技の代わりに「この技はフレームデータがないので、出る技は分かりません」を出す（コマンドが成立しても、キャラは何も出さないため）

## 外から見える形（API）

### 新規 `src/core/moveOutcome.ts`

```ts
export type MoveOutcome =
  | { kind: 'move'; move: MoveFrames; via: 'direct' | 'buffer' | 'cancel' }
  | { kind: 'none'; reason: 'noMove' | 'air' | 'bufferLost' };

export type OutcomeState =
  | { kind: 'idle' }
  /** 先行入力に入った技が出るのを待っている */
  | { kind: 'pending'; move: MoveFrames };

export const IDLE_OUTCOME: OutcomeState; // { kind: 'idle' }

/**
 * 1 フレーム進める。before・after はそのフレームの前後のキャラ（after は stepDummy のあと）。
 * attempt は、このフレームで試しがあった（analyzeAttempt が結果を返した）か。
 * 結果が決まったフレームだけ outcome を返す（決まらなければ null）
 */
export function stepMoveOutcome(
  state: OutcomeState,
  before: FighterState,
  after: FighterState,
  attempt: boolean,
): { state: OutcomeState; outcome: MoveOutcome | null };
```

- `attempt` が true のフレーム: 上の「決め」のとおり。技が始まった（`after.phase 'startup'`・`frame 0`・`move` あり）なら `via` は `after.canceled` なら `'cancel'`、そうでなければ `'direct'`、状態は idle。先行入力に入ったなら pending（outcome は null）。何も選ばれなければ `none`（`before.phase` が `prejump`・`air` なら `'air'`、それ以外は `'noMove'`）
- pending の間（`attempt` が false）: 技が始まり、その技が待っている技で、直前のフレームの先行入力（`before.buffered?.move`）か予約（`before.cancelTo`）だったら `move`（`via` は `after.canceled` なら `'cancel'`、そうでなければ `'buffer'`）。待っている技が先行入力にも予約にもなくなったら `none`・`'bufferLost'`
- 技が始まったかの見分けは、フレームメーターと同じ（`phase 'startup'`・`frame 0`・`move` あり）

### 技が選んだ技と同じか（`src/core/moveOutcome.ts`）

```ts
/** 技（フレームデータ）が、コマンド練習で選んだ技（CommandDef）に当たるか */
export function moveMatchesCommand(move: MoveFrames, command: CommandDef, rules: NotationRules): boolean;
```

技の入力（`move.input`）を `parseStep` で読み、コマンドなら表記（`notation`）が同じで、技のボタンが `command.buttons` に入っていれば true。通常技は false（コマンド練習の一覧はコマンドの技だけのため）。

### 画面（`src/ui/commandPanel.ts`・`src/main.ts`）

- `CommandPanel` に `showOutcome(text: string | null)` を足す。判定の文の下に 1 行で出す（null で消す）。技を選び直したとき・一覧を入れ替えたときは消す
- `showResult` が呼ばれたら、出た技の行は「待っている」状態の文（`outcomePending`）にする（キャラがいるときだけ。main が決める）
- `main.ts`: 練習のタブで、キャラ（フレームデータ）がいるとき、毎フレーム `stepFighter`・`stepDummy` のあとに `stepMoveOutcome` を進める。`attempt` は、そのフレームで `analyzeAttempt` が結果を返したか。結果が決まったら文にして `showOutcome` に渡す
- 選んでいる技にフレームデータの技がないとき（`fighter.data.moves` に `moveMatchesCommand` が true のものがない）は、試しのたびに `outcomeNoData` を出す
- キャラなしのときは、出た技の行は出さない

### 文（`src/i18n/messages.ts`、日本語と英語）

- `outcomeMove: (name: string, via: 'direct' | 'buffer' | 'cancel', different: boolean) => string`
  - 日本語: `出た技: {name}` に、via が buffer なら `（先行入力）`、cancel なら `（キャンセル）`、different なら `（選んだ技と違う）` を足す
  - 英語: `Came out: {name}`、` (buffered)`・` (cancel)`・` (not the selected move)`
- `outcomeNone: (reason: 'noMove' | 'air' | 'bufferLost') => string`
  - 日本語: `技は出ませんでした`、air は `技は出ませんでした（空中では出せません）`、bufferLost は `技は出ませんでした（先行入力が切れた）`
  - 英語: `No move came out`、` (cannot be used in the air)`、` (the input buffer expired)`
- `outcomePending`: `出た技: 待っています（技の途中に押したので、動けるようになったら出ます）` / `Came out: waiting (pressed during a move; it comes out when you can act)`
- `outcomeNoData`: `この技はフレームデータがないので、出る技は分かりません` / `This move has no frame data, so the move that comes out is unknown`
- 技の名前は `moveDisplayName`（例: `しゃがみ中K (2MK)`）
- i18n のテストの `SPECIAL_ARGS` に必要な引数を足す

## 受け入れ条件

キャミィ、`inputBuffer` = 4、相手はヒット。最初のボタンを押したフレームを 0。

1. 動けるときに 236HK（成立）→ そのフレームで `move`（236HK・`direct`）
2. 動けるときに 236 が崩れて 2 + MK（2MK が出る）→ そのフレームで `move`（2MK・`direct`）。`moveMatchesCommand(2MK, 236K のコマンド)` は false
3. 5LP（ヒット）のあと 13 で 2LP（チェーン）→ そのフレームで `move`（2LP・`cancel`）
4. 5LP（ヒット）のあと 18 で 5MP → 18 は pending、22 で `move`（5MP・`buffer`）
5. 5LP（ヒット）のあと 13 で 5MP（キャンセル先でない）→ pending、18 で `none`・`bufferLost`（先行入力が古くなって消える）
6. 跳んでいる間（`air`）に LP → そのフレームで `none`・`air`
7. 動けるときに方向だけ崩れた入力で、技が選ばれない（例: 236 + 存在しないボタンの組み合わせはないので、`selectMove` が null になる入力。7・8・9 を入れたままボタン → `prejump` になる前なら `noMove`）。テストで作れる形で、`attempt` が true で何も始まらず先行入力にも入らないフレームは `none`・`noMove`
8. pending の間に次の試し（`attempt` true）が来たら、新しい試しで決め直す（前の pending は捨てる）
9. `moveMatchesCommand`: 236HK と「スパイラルアロー (236K)」のコマンド → true、214LP と 236K → false
10. 画面: キャラありの練習のタブで、試しのたびに出た技の行が出る（待つ文 → 決まった文）。ブリジットの 214S を選ぶと `outcomeNoData`。キャラなしでは出ない（ヘッドレスの Chrome で確かめる）
11. `npm test`・`npm run typecheck`・`npm run build`・`npx madge --circular --extensions ts src` がすべて終了コード 0

実機との比べは `docs/manual-checks.md` の「21」に書く。

## テストのコマンド

- `npm test`・`npm run typecheck`・`npm run build`・`npx madge --circular --extensions ts src` がすべて終了コード 0

## 実装中に追記

- テストの直し: i18n の `SPECIAL_ARGS` の技名を英語（`Crouching MK (2MK)`）にした（英語の文に日本語が混ざるテストが落ちていたため）
- 実装で決めた細部: 待っている間に技を選び直したら、あとから決まった前の試しの結果は出さない（試しのときのコマンドを覚えておく）。`resetFighter` で待ちも消す
- （レビューの提案 2）予約から出た技は、試しのフレームでも「出た技」にしない（上の「決め」の最後の項目）
- 選ばなかった提案: 待っている間に、一覧で同じ技をもう一度押して選び直すと、前の試しの結果が出ることがある（同じコマンドのため見分けられない。とても起きにくい）

## 構成

```
src/core/moveOutcome.ts   出た技の追いかけ・moveMatchesCommand（新規）
src/ui/commandPanel.ts    出た技の行（変更）
src/main.ts               試しと出た技をつなぐ（変更）
src/i18n/messages.ts      文（変更）
docs/manual-checks.md     21 を足す
tests/                    moveOutcome（新規）・i18n
```
