# デスクトップ化の下調べ

目的: 「Web 版は入力が遅れる・判定がズレる」という体感をきっかけに、デスクトップ化の方式を決める材料を集める。方式は、`docs/manual-checks.md` の「4. 計測」の数値と体感が出てから決める。

使う環境: 開発は Linux（Ubuntu 26.04）、普段は Windows。

各項目に **事実**（資料やこの PC で確かめたこと）か **推測** かを書く。

## 1. 分かったこと

### 1-1. キーボード

- **事実**: 第3段階で、キーは `KeyboardEvent.timeStamp` を使って正しいフレームに割り振るようにした。描画のタイミングが揺れても、判定はズレない
- **推測**: Tauri の WebView（Windows は WebView2、Linux は WebKitGTK）でも `timeStamp` は使えるはず。キーボードは WebView のままでよく、ネイティブで読む必要は薄い。ただし WebKitGTK での `timeStamp` の基準（`performance.now()` と同じ時計か）は、実際に動かして確かめる

### 1-2. パッドを WebView（Gamepad API）で読む場合

- **事実**: WebKitGTK の Gamepad API は、ビルドのときの設定（`ENABLE_GAMEPAD`）と libmanette があるかどうかで決まる（[Buildroot の変更](https://lore.kernel.org/all/20220823203346.AAB3287BEE@busybox.osuosl.org/T/)、[WebKit の変更履歴](https://www.mail-archive.com/webkit-changes@lists.webkit.org/msg157122.html)、[WebKit Bugzilla](https://www2.webkit.org/show_bug.cgi?id=133847)、[Igalia の記事](https://blogs.igalia.com/vjaquez/gamepad-in-wpewebkit/)）
- **事実**: この PC の `libwebkit2gtk-4.1`（2.52.6）は libmanette にリンクしておらず、パッケージの依存にも入っていない
- **推測**: そのため、この PC の Tauri では WebView からパッドを読めない可能性が高い
- **事実**: Tauri の issue を探したが、Gamepad API そのものの不具合の報告は見つからなかった。Linux の WebKitGTK では、ほかのハードウェア系 API（WebRTC、YubiKey）の制限は報告されている（[#8426](https://github.com/tauri-apps/tauri/discussions/8426)、[#2261](https://github-redirect.dependabot.com/tauri-apps/tauri/discussions/2261)）
- **推測**: Windows の WebView2 は Chromium なので Gamepad API は使えるはず。ただ、読む間隔がブラウザ版と同じなら、パッドの遅れ・ズレは今と変わらない
- 結論（推測）: **パッドは WebView に頼らず、Rust 側で読むのがよい**

### 1-3. パッドを Rust で読む場合

**gilrs**（Rust のパッド用ライブラリ）
- **事実**: イベントの `time` は、gilrs がイベントを作った時刻（`SystemTime`）で、ハードウェアが入力を受けた時刻ではない（[gilrs 0.8.2 の Event](https://docs.rs/crate/gilrs/0.8.2/source/src/ev/mod.rs)、[gilrs-core](https://docs.rs/gilrs-core/0.6.4/src/gilrs_core/lib.rs.html)）
- **事実**: Windows では裏のスレッドがパッドを見に行く作りで、WGI 方式は 8ms ごと、XInput 方式は 10ms ごとに休む（[WGI の実装](https://docs.rs/crate/gilrs-core/latest/source/src/platform/windows_wgi/gamepad.rs)、[XInput の実装](https://docs.rs/crate/gilrs-core/latest/source/src/platform/windows_xinput/gamepad.rs)）
- **推測**: つまり Windows では、最大 8〜10ms の遅れと、その幅のズレが乗る。ブラウザ版（約 16ms 間隔）よりはよいが、「1F 単位で正確」には足りない場面がある
- **事実**: WGI 方式は、ウィンドウにフォーカスがないと入力を受け取れない（[gilrs-core の変更履歴](https://rust-digger.code-maven.com/src/gilrs-core-0.6.0/CHANGELOG.md)）。練習ツールとしては問題ない

**SDL3**（ゲーム用の入力・描画ライブラリ。Rust からも使える）
- **事実**: キーボード・パッドのイベントに、ナノ秒単位の時刻（`SDL_GetTicksNS()`）が付く（[SDL_KeyboardDeviceEvent](https://wiki.libsdl.org/SDL3/SDL_KeyboardDeviceEvent)、[SDL_GamepadDeviceEvent](https://wiki.libsdl.org/SDL3/SDL_GamepadDeviceEvent)、[GamepadButtonEvent の timestamp](https://sdl-d.dpldocs.dlang.org/sdl.events.SDL_GamepadButtonEvent.timestamp.html)）
- **推測**: SDL が裏でパッドをどの間隔で読んでいるか、時刻がハードウェアの受信時刻にどこまで近いかは、まだ確かめていない。試作して測る必要がある

### 1-4. Rust から画面（TypeScript）へ入力を渡す

- **事実**: Tauri では、Rust から画面へ送る方法に「イベント（emit/listen）」と「Channel」がある。たくさん流すなら Channel がよい、とされている。ただし公式の測定値は見つからなかった（[Tauri の IPC の解説](https://dev.to/hiyoyok/ipc-in-tauri-tauri-commands-vs-custom-ipc-what-to-use-when-2ab4)、[呼び出しの解説](https://playbooks.com/skills/dchuk/claude-code-tauri-skills/tauri-calling-frontend)）
- 設計上の注意: Rust の時計と画面の `performance.now()` は別の時計なので、差（オフセット）を合わせる仕組みがいる。案: 画面から Rust に問い合わせ、往復時間のいちばん短い回で差を見積もる。合わせた時刻で、パッドの入力も第3段階のキーと同じように正しいフレームに割り振る

### 1-5. 画面に出るまでの遅れ

- **推測**: WebView は描画の流れと OS 側の合成の分だけ遅れる（1〜3 フレーム程度）。判定の数値には影響しないが、体感の「遅れ」には効く。全部ネイティブで描けば縮められるが、作り直す量が大きい

### 1-6. 開発環境

- **事実**: この PC には Rust（cargo・rustc）が入っていない。Tauri にも、全部ネイティブにする場合にも必要

## 2. 方式の比較（いまの見立て）

| | (A) Tauri ＋ パッドだけ Rust | (B) 全部ネイティブ |
|---|---|---|
| 今のコード | 判定・画面・テストをほぼそのまま使える | 判定ロジックから移し替え（テストは仕様の見本として移せる） |
| キーボード | WebView のまま（時刻付きで正確） | ネイティブ（SDL3 などで時刻付き） |
| パッド | Rust（SDL3 か gilrs）で時刻付きで読み、Channel で渡す | ネイティブ |
| 画面に出るまで | WebView の分だけ遅れが残る | 縮められる |
| 作る量 | 小〜中 | 大 |

いまの見立て（推測）: **まず (A)** にする。判定の正確さは (A) で解決できる見込みが高い。画面に出るまでの遅れが計測や体感で問題になったときだけ、(B) を考える。

## 3. 計測の数値でどう決めるか

- 「キー入力から判定までの遅れ」が小さく（例: 平均 10ms 前後）、体感の不満がおもにパッドなら → (A) で十分
- キーボードでも体感が重いなら → 画面に出るまでの遅れ（1-5）が原因の候補。(A) の試作で WebView の描画の遅れを測り、それでも足りなければ (B)
- 「1回の描画で進んだフレーム数」で 2 が多い環境なら → パッドは Rust で時刻付きにしないとズレる（(A) でも (B) でも Rust 側で読む）

## 4. 次にやること（案）

1. 開発者の計測結果を受け取る（`docs/manual-checks.md` の「4. 計測」）
2. Rust を入れる（rustup。開発者の PC に入れるので、入れる前に確認を取る）
3. 小さな試作（スパイク）を作って測る
   - Tauri の空のアプリで、Linux の WebView から `navigator.getGamepads` が使えるか、`KeyboardEvent.timeStamp` の時計の基準
   - Rust でパッドを読む: gilrs と SDL3 の両方で、イベントの間隔と時刻を記録して比べる（Linux で。Windows はあとで）
   - Channel で画面に送ったときの遅れ
4. 試作の結果と計測をもとに方式を決め、設計書（`docs/plans/phase5-desktop.md`）を書く

## 5. まだ分からないこと

- WebKitGTK の `KeyboardEvent.timeStamp` の基準
- SDL3 のパッドの読み取り間隔と、時刻の正確さ
- Linux（evdev）での gilrs の読み取り方
- Tauri の Channel の実際の遅れ
- Windows の WebView2 の Gamepad API が、どの間隔でパッドを読んでいるか
