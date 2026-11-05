# 第7段階: 言語の設定（日本語 / English）

## 目的

- 設定画面で言語（日本語 / English）を選べるようにする
- 画面の文をすべて、選んだ言語で出す（ボタン、説明、結果、エラー文、メニュー、クレジット、キーコンフィグ、技名、キャラ名、注記、サンプルの名前）
- 技名は、確かめた日本語名があれば日本語で出す。なければ英語名を出す

## 訳さないもの

- 表記（`236K`・`[4]6P` など）とボタン名（LP・HS など）
- ゲームの正式名（Street Fighter 6・GUILTY GEAR -STRIVE-）
- コード内のコメント、テストの名前、docs の文書
- 保存データのキー・id

## 技名・キャラ名のデータ（2026-11-05 時点で調べたもの）

### キャミィ

日本語名の出典: AppMedia の技表（2023-07-07）。英語名の出典: kakuchopurei の技表（2023-05）。

| id | 英語 | 日本語 |
|---|---|---|
| cammy-spiral-arrow | Spiral Arrow | スパイラルアロー |
| cammy-cannon-spike | Cannon Spike | キャノンスパイク |
| cammy-quick-spin-knuckle | Quick Spin Knuckle | アクセルスピンナックル |
| cammy-cannon-strike | Cannon Strike | キャノンストライク |
| cammy-hooligan | Hooligan Combination | フーリガンコンビネーション |
| cammy-sa1 | Spin Drive Smasher | スピンドライブスマッシャー |
| cammy-sa2 | **Killer Bee Spin**（第6段階の「Killer Bee Assault」は誤り。出典は Killer Bee Spin） | キラービースピン |
| cammy-sa3 | Delta Red Assault | デルタレッドアサルト |

- 214P は、英語と日本語で名前が違う（Quick Spin Knuckle / アクセルスピンナックル）。どちらも出典どおり
- AppMedia の SA2 のコマンドは「+中K」だが、2023 年の記事で、Season 2 の変更（K→P）より前のもの。入力は今のまま 214214P

### ブリジット

日本語名は、確かめられる出典が見つからなかった（公式サイトのコマンド表は画像で、読み取れなかった）。日本語のときも英語名を出す。あとで、ゲーム内のコマンド表などで確かめた名前を足す。

（実装中に追記）第6段階の「Stop and Dash（往き）／（戻り）」は、英語名に日本語が混ざっていた。出典（dashfight）の書き方に合わせて `Stop and Dash (Hit on Send)`・`Stop and Dash (Hit on Return)` にする。

### キャラ名

| id | 日本語 | 英語 |
|---|---|---|
| cammy | キャミィ | Cammy |
| bridget | ブリジット | Bridget |

## 外から見える形（API）

### 言語（`src/i18n/lang.ts`）

```ts
export type Lang = 'ja' | 'en';
export const LANGS: readonly Lang[];            // ['ja', 'en']
/** ブラウザの言語（navigator.language）から初めの言語を決める。'ja' で始まれば 'ja'、それ以外は 'en' */
export function langFromBrowser(navigatorLanguage: string | undefined): Lang;
export function getLang(): Lang;                // 初めは 'ja'
export function setLang(lang: Lang): void;
```

### 文の表（`src/i18n/messages.ts`）

- `ja` と `en` の 2 つの表を持つ。キーは同じ（TypeScript の型で、片方にしかないキーをエラーにする）
- 数字などが入る文は関数にする。例: `comboEarly: (n: number) => string`
- `export function msg(): Messages` は、いまの言語（`getLang()`）の表を返す
- 画面や文を作る関数（`describeResult`・`describeDrop`・`describeHit`・`parseRecipe`・`parseStep` のエラー文など）は `msg()` から文を取る。引数の形は変えない。いまのテストは日本語（初めの言語）のまま通る

### 言語ごとの名前（`src/i18n/localized.ts`）

```ts
/** 言語ごとの名前。ja はなくてもよい（ないときは en を使う） */
export interface LocalizedText { en: string; ja?: string }
export function pick(text: LocalizedText, lang: Lang): string;   // lang が 'ja' で ja があれば ja、それ以外は en
```

- `MoveData.name`・`MoveData.note`・`CharacterData.name`・`ComboData.name` を `LocalizedText` にする（注記は ja と en の両方を書く）
- `moveToCommand(move, rules, lang = getLang())` の `name` は `pick(move.name, lang)` を使う
- コマンド練習の一覧（`SF6_COMMANDS`・`GG_COMMANDS`）の名前と、サンプル（`SF6_SAMPLES`・`GG_SAMPLES`）の名前も、言語で変わるようにする。形は実装に任せるが、`id` と判定は変えない
- `GAMES` の「メルブラ（今後追加）」は、英語では `MELTY BLOOD (coming later)`

### 設定（`src/core/settings.ts`）

- `Settings` に `lang: Lang` を足す
- `parseSettings(raw, fallbackLang: Lang = 'ja')`: `lang` がない・おかしいときは `fallbackLang`。前の版の保存も読める
- `serializeSettings` は `lang` も書く
- main.ts は、初めて開いたとき（保存がないとき）は `langFromBrowser(navigator.language)` を使う

### 画面

- 設定画面の項目に「言語」を足す（音量の下、クレジットの上）。←→ か決定で 日本語 ⇄ English を切り替える。マウスではボタンで選べる
- 言語を変えたら、保存してページを読み直す（パネルを作り直す手間を省くため）。読み直したあとは設定画面を開く（`sessionStorage` に 1 回だけの印を置く。使えないときはタイトルでよい）
- `<html lang>` を言語に合わせる

### 抜けを防ぐ仕組み

- `src/` の `.ts` ファイルのうち、`src/i18n/` と、データのファイル（キャラの日本語名を持つ `src/core/characters.ts`）を除いたものに、日本語（ひらがな・カタカナ・漢字）を含む文字列リテラルがないことをテストで確かめる。コメントは対象外
- `en` の表に、日本語の文字が入っていないことをテストで確かめる

## 受け入れ条件

1. `langFromBrowser`: `'ja'`・`'ja-JP'` は `'ja'`、`'en-US'`・`'fr'`・`undefined`・`''` は `'en'`
2. `getLang` の初めは `'ja'`。`setLang('en')` のあとは `'en'`
3. `ja` と `en` の表のキーが同じ。どの値も空でない（関数は代表の引数で呼んで空でない）。`en` に日本語の文字がない
4. `setLang('en')` のとき、`describeResult` などの文が英語になる（代表として `describeResult` の成立と `incomplete`、`describeDrop` の early、`parseRecipe` のエラー 1 つ）。`'ja'` に戻すと今と同じ文
5. `pick`: ja があれば ja、なければ en。`lang` が en なら en
6. キャラのデータ: キャミィの技名は上の表のとおり（英語と日本語）。SA2 の英語名は `Killer Bee Spin`。ブリジットの技名に `ja` はない。キャラ名は表のとおり。注記のある技は、ja と en の両方がある
7. `moveToCommand(move, rules, 'en')` の名前は `Spiral Arrow (236K)`、`'ja'` なら `スパイラルアロー (236K)`。ブリジットは `'ja'` でも `Kick Start My Heart (236K)`
8. `parseSettings`: `lang` が `'en'` なら `'en'`。ない・`'fr'`・数値なら `fallbackLang`。`serializeSettings` との往復で元に戻る
9. `src/` の文字列リテラルに日本語が残っていない（上の「抜けを防ぐ仕組み」）
10. `npm test`・`npm run typecheck`・`npm run build` がすべて終了コード 0。循環 import がない（`npx madge --circular --extensions ts src`）

画面（言語の切り替え、読み直し後に設定画面が開くこと、英語での見た目）は、`docs/manual-checks.md` の「12. 言語の設定」に書く。

## テストのコマンド

- `npm test`・`npm run typecheck`・`npm run build`・`npx madge --circular --extensions ts src` がすべて終了コード 0

## 構成

```
src/i18n/lang.ts        言語（新規）
src/i18n/messages.ts    文の表（新規）
src/i18n/localized.ts   言語ごとの名前（新規）
src/core/*.ts           文を msg() から取る。characters.ts は名前を LocalizedText に（変更）
src/input/*.ts          同上（変更）
src/ui/*.ts, src/main.ts  同上。設定画面に言語（変更）
index.html              lang は main.ts から設定（変更）
docs/manual-checks.md   12 を足す
tests/                  新しいテストを足す。名前の形が変わるテスト（characters など）は直す
```
