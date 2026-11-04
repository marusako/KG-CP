# 第5段階 ①: タイトル画面

## 目的

アプリを開くと、まずタイトル画面が出るようにする。開発者の希望の構成:

```
タイトル
├ ① ゲーム選択
│   ├ Street Fighter 6
│   ├ GUILTY GEAR -STRIVE-
│   └ メルブラ（今後追加）※選べない
├ ② 設定
│   ├ 音量設定
│   └ クレジット
└ ③ EXIT
```

3 段に分けたうちの 1 段目。ここでは画面の流れだけを作る。

- ゲームを選ぶと、今の練習画面（コマンド練習・コンボトライアル・キーコンフィグ）に入る。中身はまだスト6 の形のまま。ゲームごとのボタンとコマンドは 2 段目、猶予は 3 段目で入れる
- 音量はスライダーと保存だけ。音はまだ出さない
- EXIT は、Web 版ではタブを閉じられない（`window.close()` は、スクリプトで開いたタブにしか効かない）。押すと、タブを閉じるよう案内を出す。デスクトップ版では、アプリを終了する（デスクトップ版を作るときに足す）

判定ロジック（`detect.ts`・`combo.ts` など）は変えない。

## 構成

```
src/core/games.ts      ゲームの一覧（新規）
src/core/menu.ts       メニューのカーソル移動と、押した瞬間の操作の取り出し（新規・純粋な関数）
src/core/settings.ts   設定の読み書き（新規・純粋な関数）
src/ui/screens.ts      タイトル・ゲーム選択・設定・クレジット・EXIT の画面（新規）
src/main.ts            画面の切り替えと、メニュー中の入力の扱い（変更）
src/ui/style.css       メニューの見た目（変更）
tests/games.test.ts, tests/menu.test.ts, tests/settings.test.ts
```

## テストのコマンド

- `npm test`・`npm run typecheck`・`npm run build` がすべて終了コード 0

## 外から見える形（API）

### ゲームの一覧（`src/core/games.ts`）

```ts
export type GameId = 'sf6' | 'ggst' | 'mbtl';
export interface GameInfo {
  id: GameId;
  /** 画面に出す名前 */
  name: string;
  /** false なら一覧には出すが選べない */
  available: boolean;
}
/** 並びは sf6, ggst, mbtl。名前は 'Street Fighter 6'・'GUILTY GEAR -STRIVE-'・'メルブラ（今後追加）'。mbtl だけ available: false */
export const GAMES: readonly GameInfo[];
/** id から探す。ないか、文字列でなければ undefined */
export function findGame(id: unknown): GameInfo | undefined;
```

### メニュー（`src/core/menu.ts`）

```ts
export interface MenuItem {
  label: string;
  /** true なら選べない（カーソルが止まらない） */
  disabled?: boolean;
}

/** 最初の選べる項目の番号。選べる項目がなければ -1 */
export function firstEnabled(items: readonly MenuItem[]): number;

/**
 * カーソルを delta（+1 で下、-1 で上）の方向の、次の選べる項目へ動かす。
 * 端を越えたら反対の端から続ける。選べない項目は飛ばす。
 * 選べる項目がほかになければ、cursor をそのまま返す
 */
export function moveCursor(items: readonly MenuItem[], cursor: number, delta: 1 | -1): number;

/** メニューの操作に使う、いま押しているもの */
export interface MenuButtons {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  confirm: boolean;
  back: boolean;
}
export type MenuAction = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back';
export const NO_MENU_BUTTONS: MenuButtons; // 全部 false

/** prev では押していなくて now で押しているものを、up, down, left, right, confirm, back の順で返す */
export function menuActions(prev: MenuButtons, now: MenuButtons): MenuAction[];
```

### 設定（`src/core/settings.ts`）

```ts
import type { GameId } from './games';

export interface Settings {
  /** 0〜100 の整数 */
  volume: number;
  /** 最後に選んだゲーム。ゲーム選択の最初のカーソル位置に使う */
  lastGame: GameId | null;
}
export const DEFAULT_SETTINGS: Settings; // { volume: 80, lastGame: null }

/**
 * 保存した文字列（なければ null）から読む。壊れていても例外を投げない。
 * - JSON として読めない・オブジェクトでない → DEFAULT_SETTINGS と同じ値
 * - 項目ごとに見て、おかしい項目だけ既定値にする
 * - volume: 数（有限）なら 0〜100 に収めて四捨五入。それ以外は既定値
 * - lastGame: 選べる（available な）ゲームの id ならそれ。それ以外は null
 */
export function parseSettings(raw: string | null): Settings;
export function serializeSettings(s: Settings): string;
```

`localStorage`（キー `kgcp.settings`）への読み書きは画面側で行い、try/catch で包む（使えなくても動く）。

## 画面の動き（`src/ui/screens.ts`・`src/main.ts`）

画面は `title`・`gameSelect`・`settings`・`credits`・`exit`・`game` の 6 つ。開くと `title`。

| 画面 | 中身 | 決定 | 戻る |
|---|---|---|---|
| title | アプリ名「KG-CP」、項目「ゲーム選択」「設定」「EXIT」 | それぞれの画面へ | なし |
| gameSelect | `GAMES` を並べる。メルブラは灰色で選べない。最初のカーソルは `lastGame`（なければ先頭） | `game` へ。`lastGame` を保存 | title |
| settings | 「音量」（スライダーと数値。「効果音はまだありません」と注記）と「クレジット」 | クレジットなら `credits` へ | title |
| credits | 作者「marusako」、ソースコードの URL（https://github.com/marusako/KG-CP）、断り書き（下） | なし | settings |
| exit | 「ブラウザ版は、ここからは閉じられません。タブを閉じて終了してください」 | なし | title |
| game | 今の練習画面。上に、選んだゲームの名前と「タイトルへ」ボタン。スト6 以外では「ボタンとコマンドは、まだスト6 の形です」と注記 | — | 「タイトルへ」ボタンだけ |

断り書き: 「各ゲームの名称は、それぞれの権利者の商標または登録商標です。このアプリは非公式のファンメイドツールで、権利者とは関係ありません。」（会社名は書かない。ロゴや公式の画像は使わない）

操作（`game` 以外の画面）:
- マウス: 項目をクリックで決定。項目にマウスを乗せるとカーソルが移る。「戻る」ボタンも置く
- キーボード: ↑↓ キーと、上・下に割り当てたキー（初期は W・S）でカーソル移動。←→ と、左・右に割り当てたキーで音量を 5 ずつ変える（音量にカーソルがあるとき）。Enter で決定、Esc で戻る
- パッド: 十字キー・左スティックで移動と音量。決定はボタン 0（Xbox の A、PlayStation の ×）、戻るはボタン 1（B、○）。PS5 と Xbox に合わせ、下のボタンを決定にする
- キーとパッドの押した瞬間は `menuActions` で取り出す（押しっぱなしで何度も動かない）

ゲームの入力との分け方:
- `game` 以外の画面にいる間は、キーコンフィグの捕まえ中と同じく `filterInput` の `capturing` を true にして、練習画面に入力を渡さない
- そのため、決定に使ったキーやボタンを押したまま `game` に入っても、離すまで練習の入力にならない
- `game` に入るとき、コンボトライアルを最初の手に戻す
- `game` から「タイトルへ」で出たときも同じ扱い（練習の途中の状態は捨てる）

## 受け入れ条件

1. `GAMES`・`findGame`
   - 並び・名前・available が上のとおり
   - `findGame('ggst')` は GUILTY GEAR -STRIVE-。`findGame('xx')`・`findGame(1)`・`findGame(null)` は undefined
2. `firstEnabled`・`moveCursor`
   - 先頭が選べなければ、次の選べる項目を返す。全部選べなければ -1
   - 下へ: 選べない項目を飛ばす。最後から先頭へ回る
   - 上へ: 選べない項目を飛ばす。先頭から最後へ回る
   - 選べる項目が 1 つだけなら、そのまま
3. `menuActions`
   - 押していなかったものを押したときだけ返す。押し続けている間は返さない
   - 同時に押したら、決まった順（up, down, left, right, confirm, back）で全部返す
4. `parseSettings`・`serializeSettings`
   - null・壊れた JSON・配列・数値 → 既定値
   - volume: 150 → 100、-3 → 0、42.6 → 43、'50'（文字列）・NaN 相当・なし → 80
   - lastGame: 'ggst' → 'ggst'、'mbtl'（選べない）・'xx'・数値 → null
   - 片方だけおかしければ、もう片方は保存した値のまま
   - `parseSettings(serializeSettings(s))` が s と同じになる（正しい s なら）
5. 画面（手で確かめる。`docs/manual-checks.md` に「8. タイトル画面」として足す）
   - 開くとタイトルが出て、3 つの項目がマウス・キーボード・パッドで選べる
   - メルブラは灰色で、カーソルが止まらず、クリックしても何も起きない
   - スト6・GG を選ぶと練習画面に入り、上にゲーム名が出る。GG では注記が出る
   - 決定に使った Enter やボタンを押したまま入っても、練習の入力にならない
   - 「タイトルへ」で戻れる。戻ってもう一度入ると、コンボトライアルは最初の手から
   - 音量を変えて再読み込みしても残る。最後に選んだゲームにカーソルがある
   - クレジットに作者名・URL・断り書きが出る
   - EXIT で案内が出て、戻れる
   - メニューで W・S や ↑↓ を押しても、練習画面の入力履歴が流れない

## やらないこと

- ゲームごとのボタン・コマンド・キーの割り当て（2 段目）、猶予（3 段目）
- 効果音、BGM
- デスクトップ版の EXIT（デスクトップ版を作るときに足す）
- キーの割り当てを設定画面に移すこと（いまのまま練習画面に置く）
- メニューのカーソルの押しっぱなしでの連続移動
