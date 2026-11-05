# 第6段階: キャラクター選択と、キャラごとの技・コンボの練習

## 目的

- ゲームを選んだあとに、キャラクター選択の画面を出す
- キャラを選ぶと、そのキャラの必殺技・超必殺技をコマンド練習で、そのキャラのコンボをコンボトライアルで練習できる
- どちらの一覧にも検索欄を付け、名前や表記（例: `236`、`spiral`）で絞り込める
- 最初に入れるキャラは、スト6 のキャミィと、GG のブリジット
- 「キャラなし（共通）」も選べる。選ぶと、いまと同じ一覧になる

キャラの絵や公式のアイコンは使わない（著作物のため）。名前の文字だけにする。
データはアプリの中に入れておく。wiki をその場で読みに行くことはしない（CORS と、サイト側のアクセス拒否のため）。

## データ（2026-11-05 時点で調べたもの）

### キャミィ（スト6、クラシック操作）

出典: kakuchopurei の技表（2023-05）。SA2 だけは、Season 2 のパッチノート（2024-05-21、EventHubs の記事で確認）で K→P に変わったので P にした。

| id | 名前 | 入力 | 種類 | 注記 |
|---|---|---|---|---|
| cammy-spiral-arrow | Spiral Arrow | 236K | 必殺技 | |
| cammy-cannon-spike | Cannon Spike | 623K | 必殺技 | |
| cammy-quick-spin-knuckle | Quick Spin Knuckle | 214P | 必殺技 | |
| cammy-cannon-strike | Cannon Strike | 214K | 必殺技 | 前ジャンプ中に出す技。アプリでは地上と同じに判定する |
| cammy-hooligan | Hooligan Combination | 236P | 必殺技 | 派生（K など）は練習の対象外 |
| cammy-sa1 | Spin Drive Smasher | 236236K | SA1 | |
| cammy-sa2 | Killer Bee Assault | 214214P | SA2 | Season 2 で K から P に変更 |
| cammy-sa3 | Delta Red Assault | 236236P | SA3 | |

コンボ（窓はゆるい仮の値。下の「ゆるい窓」）:

| id | 名前 | 手 | 出典 |
|---|---|---|---|
| cammy-combo-1 | 2LK > 2LP > 623HK | 2LK / 2LP（つなぎ） / 623HK（キャンセル） | Sportskeeda のキャミィのコンボガイド |
| cammy-combo-2 | 2HP > 2MP > 236HK | 2HP / 2MP（つなぎ） / 236HK（キャンセル） | SuperCombo wiki（検索結果の抜粋で確認） |
| cammy-combo-3 | 2MP > 214LP | 2MP / 214LP（キャンセル） | SuperCombo wiki（検索結果の抜粋で確認） |

### ブリジット（GG）

出典: dashfight の技表。Starship の入力は gamezo の記事（623P）。Rock the Baby は dashfight だけで確認（1 か所のみ）。

| id | 名前 | 入力 | 種類 | 注記 |
|---|---|---|---|---|
| bridget-kick-start | Kick Start My Heart | 236K | 必殺技 | 派生の Shoot（K）・Brake（P）は練習の対象外 |
| bridget-roger-dive | Roger Dive | 236K | 必殺技 | 空中で出す技。アプリでは地上と同じに判定する |
| bridget-stop-and-dash-send | Stop and Dash（往き） | 236S・236HS | 必殺技 | |
| bridget-stop-and-dash-return | Stop and Dash（戻り） | 214S・214HS | 必殺技 | |
| bridget-rolling-movement | Rolling Movement | 214K | 必殺技 | ヨーヨーを出しているときだけ出る |
| bridget-starship | Starship | 623P | 必殺技 | |
| bridget-rock-the-baby | Rock the Baby | 632146P | 必殺技 | 空中でも出せる |
| bridget-loop-the-loop | Loop the Loop | 632146S | 覚醒必殺技 | |
| bridget-killing-machine | Return of the Killing Machine | 632146HS | 覚醒必殺技 | |

コンボ:

| id | 名前 | 手 | 出典 |
|---|---|---|---|
| bridget-combo-1 | 5S > 2S > 2HS > 236K | 5S / 2S（キャンセル） / 2HS（キャンセル） / 236K（キャンセル） | Dustloop の基本ルート（c.S > 2S > 2H > 236K）。アプリは近S と遠S を分けないので 5S と書く |

### ゆるい窓

コンボの手ごとに「つなぎ（link）」か「キャンセル（cancel）」を書き、窓はそこから決める。

- つなぎ: `[4, 20]`
- キャンセル: `[0, 15]`

フレームデータからの正確な窓は、あとの段で扱う。

## 構成

```
src/core/commands.ts    スト6 の表記用のモーション一覧 SF6_MOTIONS を足す（変更）
src/core/characters.ts  キャラのデータと、データを練習用の形にする関数（新規）
src/core/search.ts      絞り込みの関数（新規）
src/core/settings.ts    最後に選んだキャラを覚える（変更）
src/core/storageKeys.ts キャラごとのレシピの保存場所（変更）
src/core/profiles.ts    practiceCommands と PLAYABLE_GAME_IDS を足す（変更。実装中とレビューのあとに追記）
src/ui/searchInput.ts   2 つのパネルで使う検索欄（新規。実装中に追記）
src/ui/screens.ts       キャラ選択の画面（変更）
src/ui/commandPanel.ts  検索欄と注記（変更）
src/ui/comboPanel.ts    検索欄、キャラのコンボ（変更）
src/main.ts             キャラの切り替え（変更）
docs/manual-checks.md   「11. キャラクター選択」を足す
```

## 外から見える形（API）

### スト6 の表記のルール（`src/core/commands.ts`）

- `SF6_MOTIONS: CommandDef[]` を足す。表記の方向の部分ごとに 1 つずつで、ボタンはスト6 の 6 つ全部。
  - 対象は `236`・`214`・`623`・`41236`・`63214`・`[4]6`・`[2]8`・`360`・`236236`・`214214`
  - 方向・`motionWindow`・`buttonWindow`・`minHold` は、`SF6_COMMANDS` の同じ表記のものと同じにする
  - `236236`・`214214` は `motionWindow` が `LONG_MOTION_WINDOW`（25）、`buttonWindow` が `BUTTON_WINDOW`（6）。値は仮
- `SF6_RULES.commands` を `SF6_MOTIONS` にする。これで `623K`・`236K`・`236236K` が読めるようになる。いま読める表記（`236HP`・`[4]6P` など）は、同じ方向・同じ窓のまま読める
- `SF6_COMMANDS`（キャラなしのコマンド練習の一覧）は変えない
- （実装中に追記）`GameProfile.commands` は表記を読むための一覧になるので、キャラなしの練習の一覧は `GameProfile.practiceCommands` に分ける。sf6 は `SF6_COMMANDS`、ggst は `GG_COMMANDS`

### キャラのデータ（`src/core/characters.ts`）

```ts
export type MoveKind = 'special' | 'super';
export interface MoveData {
  id: string;
  name: string;
  /** 表記。複数のときは、方向が同じでボタンだけ違うもの（例: ['236S', '236HS']） */
  inputs: readonly string[];
  kind: MoveKind;
  note?: string;
}
export interface ComboStepData { input: string; join?: 'link' | 'cancel' }  // 最初の手は join なし
export interface ComboData { id: string; name: string; steps: readonly ComboStepData[]; source: string }
export interface CharacterData {
  id: string;            // 'cammy'・'bridget'
  game: PlayableGameId;
  name: string;          // 画面に出す名前。'キャミィ'・'ブリジット'
  moves: readonly MoveData[];
  combos: readonly ComboData[];
}
export const CHARACTERS: readonly CharacterData[];
export function charactersFor(game: PlayableGameId): CharacterData[];   // CHARACTERS の順
export function findCharacter(game: PlayableGameId, id: unknown): CharacterData | undefined;
export const LOOSE_WINDOWS: { link: { min: 4; max: 20 }; cancel: { min: 0; max: 15 } };

/** 技を練習用の CommandDef にする。id と name は技のもの（name は「名前 (入力)」の形。入力が複数なら「・」でつなぐ）。
 *  方向と猶予は表記から読んだコマンドと同じ、buttons は inputs のボタンを合わせたもの。読めなければ null */
export function moveToCommand(move: MoveData, rules: NotationRules): CommandDef | null;
/** コンボを ComboRecipe にする。窓は LOOSE_WINDOWS。読めなければ null */
export function comboToRecipe(combo: ComboData, rules: NotationRules): ComboRecipe | null;
```

- データは上の表のとおり。`name` の例: `Spiral Arrow (236K)`、`Stop and Dash（往き） (236S・236HS)`
- 入れたデータは、すべて `moveToCommand`・`comboToRecipe` で null にならない（テストで確かめる）

### 絞り込み（`src/core/search.ts`）

```ts
/** 検索のための正規化。NFKC（全角の数字・英字を半角にする）と、小文字にすること、前後の空白を取ること */
export function normalizeQuery(text: string): string;
/** query を空白で区切った語が、すべて texts(item) のどれかに含まれるものを、元の順で返す。query が空なら全部 */
export function filterItems<T>(items: readonly T[], query: string, texts: (item: T) => readonly string[]): T[];
```

例: `２３６` は `236` に、`Spiral` は `spiral` になる。`236 k` は `Spiral Arrow (236K)` に当たる。

### 設定（`src/core/settings.ts`）

- `Settings` に `lastCharacter: Partial<Record<PlayableGameId, string>>` を足す。キャラなしは、その項目がない状態
- `DEFAULT_SETTINGS.lastCharacter` は `{}`
- `parseSettings` は、前の版の保存（`lastCharacter` がない）も読める。キャラの id が `findCharacter` で見つからないもの、文字列でないものは捨てる
- `serializeSettings` は `lastCharacter` も書く

### 保存場所（`src/core/storageKeys.ts`）

- `recipesKeys(id, characterId?)`。`characterId` がないときはいまと同じ。あるときは `save` も `read` も `kgcp.comboRecipes.<game>.<character>` だけ（前の版のキーは読まない）

### 画面

- 画面の種類に `charSelect` を足す。流れは「タイトル → ゲーム選択 → キャラ選択 → 練習」
- キャラ選択の項目: 先頭が「キャラなし（共通）」、そのあとに `charactersFor(game)` の名前。カーソルの初期位置は、最後に選んだキャラ（なければ「キャラなし」）
- 「戻る」（Escape・パッドの B）はゲーム選択へ
- 練習画面の上のバー: `Street Fighter 6 / キャミィ` のようにキャラ名も出す（キャラなしならゲーム名だけ）。「キャラ選択へ」のボタンを足す
- `ScreensOptions.onSelectGame` はいまのまま。キャラを選んだときの `onSelectCharacter(game, characterId | null)` を足す

### コマンド練習（`src/ui/commandPanel.ts`）

- 一覧の上に検索欄を付ける。入力のたびに `filterItems` で、名前（`name`）と表記（`notation`）で絞り込む
- 絞り込んで選んでいる技が一覧から消えても、選択はそのまま。0 件のときは「当たる技がありません」
- `setCommands(commands, notes?: ReadonlyMap<string, string>)`。`notes` は id → 注記。選んでいる技に注記があれば、結果の上に出す
- `setCommands` を呼ぶと、検索欄は空に戻す
- 検索欄に文字を入れている間のキー入力は、練習の入力にしない。いまの、キーコンフィグの「捕まえ中」と同じ止め方にする（`filterInput` の capturing に、検索欄にフォーカスがあることを足す）。Escape を押すか、フォーカスが外れたら戻る

### コンボトライアル（`src/ui/comboPanel.ts`）

- 一覧の上に検索欄。名前と、手の表記（`steps[].text`）で絞り込む
- `setProfile(profile, character?: CharacterData)`。キャラがあるときは、サンプルの代わりにキャラのコンボ（`comboToRecipe`）を並べ、保存したレシピの場所はキャラごと（`recipesKeys(game, character.id)`）にする。キャラなしはいまと同じ
- キャラのコンボには「窓は仮の値です」という注記を出す

### main.ts

- キャラを選んだら `settings.lastCharacter` を書き、コマンド練習には `moveToCommand` で作った一覧（null は除く）と注記を、コンボトライアルにはキャラを渡す
- キャラなしなら、いまと同じ（`profile.commands` とサンプル）

## 受け入れ条件

1. `SF6_RULES` で `236K`・`623K`・`214P`・`236236K`・`214214P`・`236236P` が読める。いま読める表記は、同じ方向・同じ窓・同じボタンで読める。`SF6_COMMANDS` は変わらない
2. `CHARACTERS` は上の表のとおり（キャラ 2 人、技の id・入力・種類、コンボの id・手・つなぎ方）。全部の技と全部のコンボが、そのゲームのルールで null にならない
3. `moveToCommand`: 例えば Stop and Dash（往き）の `buttons` は `['S', 'HS']`、方向は 236 と同じ、名前は決まりどおり。Cannon Spike の `buttonWindow` は スト6 の 623 と同じ 6
4. `comboToRecipe`: つなぎは `[4, 20]`、キャンセルは `[0, 15]`、最初の手は窓なし
5. `normalizeQuery`・`filterItems` が上の例どおり。空の検索は全部を返す。順番は元のまま
6. `parseSettings`: 前の版の保存（`{"volume":50,"lastGame":"sf6"}`）を読むと `lastCharacter` は `{}`。知らないキャラの id・違うゲームのキャラの id・文字列でない値は捨てる。`serializeSettings` との往復で元に戻る
7. `recipesKeys('sf6', 'cammy')` は `{ save: 'kgcp.comboRecipes.sf6.cammy', read: ['kgcp.comboRecipes.sf6.cammy'] }`。`characterId` なしはいまと同じ
8. `npm test`・`npm run typecheck`・`npm run build` がすべて終了コード 0

画面（7 より後の部分）は、手で確かめる項目として `docs/manual-checks.md` の「11」に書く。

## テストのコマンド

- `npm test`・`npm run typecheck`・`npm run build` がすべて終了コード 0
