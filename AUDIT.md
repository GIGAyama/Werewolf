# ✅ GIGA Standard v4 監査：人狼ゲーム（Werewolf）

- 監査日：2026-08-03
- リポジトリ：`GIGAyama/Werewolf`
- 判定した型：**B型（Vite + React + TypeScript）**
  - 根拠：`vite.config.ts` あり／`.gs` なし／`manifest.json`(MV3) なし
- 公開先：GitHub Pages（`https://gigayama.github.io/Werewolf/`）
- 計測方法：`npm ci && npm run build` を実行したうえで、実ファイル・実ビルド成果物を `grep` / `wc` / `ls` で実測。推測値は含まない。

---

## 総評

ゲームロジック・ふりがな・音声ガイドの作り込みは良好で、**致命的な破壊（他アプリのキャッシュ削除・`localStorage.clear()`・秘密情報の直書き）は1件もない**。
一方で、**GIGA 標準としての「土台」がほぼ未整備**である。特に次の4点が実害につながる。

1. **LICENSE / MANUAL.md / dependabot が無い** — 学校配布物としての体裁が整っていない。
2. **manifest に `id` が無く、`scope`/`start_url` が相対（`.`）** — `gigayama.github.io` は数十個のアプリで同一オリジンを共有しているため、識別子が曖昧なままだと「別アプリが立ち上がる」事故域に入る。
3. **フォントを Google Fonts CDN から読んでいる** — 初回オフライン時に本文フォントが当たらず、校内 Wi-Fi で 40 台同時だと外部通信がボトルネックになる。CSP も入れられない。
4. **インストール導線が無い**（`beforeinstallprompt` 未捕捉・アプリ内インストールボタン無し・更新通知無し・`offline.html` 無し）。PWA と謳っているが、実際には「入れてもらう仕組み」が欠けている。

---

## A. 法務・配布

| # | 項目 | 判定 | 実測 |
|---|---|:--:|---|
| A1 | LICENSE 実ファイル | ❌ | `LICENSE` が存在しない（`ls LICENSE` → No such file）。README には「© 2026 人狼ゲーム GIGA山」の記載のみ |
| A2 | .gitignore | ⚠️ | 存在する（`node_modules` `dist` `.DS_Store` 等）。ただし `.env` 系の除外指定が無い |
| A3 | dependabot.yml | ❌ | `.github/dependabot.yml` が存在しない |
| A4 | README.md / MANUAL.md 両方 | ⚠️ | `README.md` はあり（開発者向けとして良質）。`MANUAL.md`（先生向け）が無い。README にも「🔐セキュリティ設計」「⚠️制限とクォータ」の節が無い |

---

## B. セキュリティ

| # | 項目 | 判定 | 実測 |
|---|---|:--:|---|
| B1 | CSP（connect-src が最小） | ❌ | `Content-Security-Policy` の記述 0 件。加えて `fonts.googleapis.com` / `fonts.gstatic.com` への外部通信があるため、現状のままでは厳しい CSP を張れない |
| B2 | 秘密情報・IDの直書きなし | ✅ | `git ls-files` に `.env` / `.clasp.json` なし。APIキー・スプレッドシートID・メールアドレスの直書きなし。外部送信コードなし |
| B3 | OAuthスコープ最小 | — | 該当なし（GAS を使わない静的アプリ） |
| B4 | postMessage の宛先が `*` でない | ✅ | `postMessage` の使用 0 件 |
| B5 | サーバー側5段ガード | — | 該当なし（サーバーを持たない。個人情報も端末外に出ない） |
| B6 | 依存の脆弱性 | ⚠️ | `npm audit` → 6件（high 4 / moderate 2）。内訳は後述。**すべて開発時のみ利用される依存**で、配信物 `dist/` には含まれない |

### B6 の内訳（実測）

| パッケージ | 深刻度 | 影響範囲 | 対処 |
|---|---|---|---|
| `brace-expansion` | high | ビルド時のみ | `npm audit fix`（非破壊）で解消可 |
| `fast-uri` | high | ビルド時のみ | `npm audit fix`（非破壊）で解消可 |
| `esbuild` ≤0.24.2（→ `vite` / `vite-plugin-pwa`） | moderate | **開発サーバーのみ**。`npm run dev` 中に他サイトから開発サーバーへリクエストできる問題 | 解消には `vite@8` へのメジャー更新が必要。**改修モードの規則によりメジャー更新は行わない**（`npm audit fix --force` は禁止）。本番配信物への影響なし |
| `sharp` <0.35.0 | high | **アイコン生成時のみ**（`npm run icons`） | 解消には `sharp@0.35` へのメジャー更新が必要。同上の理由で見送り。ローカルの自作画像しか処理しないため実リスクは低い |

---

## C. 堅牢性

| # | 項目 | 判定 | 実測 |
|---|---|:--:|---|
| C1 | LockService + try/finally | — | 該当なし（GAS 不使用） |
| C2 | 自動復旧 | — | 該当なし（永続データを持たない） |
| C3 | pagehide で記録確定 | — | 該当なし。`localStorage` の使用 0 件で、そもそも保存する記録が無い |
| C4 | 通信失敗時のリトライと明示 | ⚠️ | アプリ本体は通信しないが、**Web フォントだけが外部依存**。初回オフライン時にフォントが当たらず表示が崩れる（`offline.html` も無い） |
| C5 | localStorage.clear() を使っていない | ✅ | `localStorage` 自体の使用が 0 件 |
| C6 | ゲーム進行の破綻 | ✅ | 決選投票・同数ランダム・狩人の連続ガード禁止・複数人狼の合議まで実装済み。`checkForWinner` の勝敗判定（狂人を人間の頭数に数える）も一般的な人狼ルールに一致 |

---

## D. 表示（Part I §2）

| # | 項目 | 判定 | 実測 |
|---|---|:--:|---|
| D1 | viewport に viewport-fit=cover | ✅ | `index.html:9` に記載あり |
| D2 | 100dvh を使用（100vh 単独でない） | ⚠️ | `100vh` の使用 0 件。`h-[100dvh]`（`App.tsx:719`）`max-h-[90dvh]`（`App.tsx:374`）を使用。ただし **`dvh` 非対応の古い端末向けフォールバックが無い**（Chromebook の古い ChromeOS で高さ 0 になりうる） |
| D3 | safe-area-inset を適用 | ⚠️ | `index.css:253,256` に `safe-top` / `safe-bottom` あり。**左右（`safe-area-inset-left/right`）が未適用**で、iPad/iPhone を横向きにするとノッチ側が欠ける |
| D4 | clamp() による fluid type | ✅ | `index.css:15` `font-size: clamp(14px, 1.9vw + 6px, 20px)`。Tailwind が rem 基準なので全体に効く。良い設計 |
| D5 | Canvas に devicePixelRatio 補正 | — | 該当なし（`getContext(` の使用 0 件。Canvas 未使用） |
| D6 | 320px 幅で横スクロールが出ない | ❌ | **不合格。** 人数選択の `grid-cols-3` セル幅は 320px 時に約 80px だが、`Button` の `px-8`(=2rem) + `text-2xl` で最小約 106px 必要。`body { overflow: hidden }`（`index.css:24`）のため**スクロールもできず内容が欠ける**（＝より悪い） |
| D7 | 画像に width/height、150KB以下 | ⚠️ | `<img>` タグ 0 件（アイコンは lucide-react の SVG）＝CLS 懸念なし。ただし PWA アイコンの容量超過あり（§F 参照） |
| D8 | コントラスト 4.5:1 以上 | ⚠️ | フッター `text-white/50`（`App.tsx:330`）は背景 `#111827`/80% に対して約 3.9:1 で**未達**。`text-white/40`（`App.tsx:698` 死亡プレイヤー）も未達。ただし後者は「取り消し線＋ドクロアイコン」を併用しており、色だけで意味を伝えてはいない |
| D9 | タップ領域 44px 以上・touch-action | ❌ | `touch-action` の記述 0 件（ダブルタップの 300ms 遅延が残る）。役職の増減ボタンは `w-10 h-10`＝2.5rem で、320px 端末（ルート 14px）では **35px** と 44px 未満。ヘッダーの `w-12 h-12` も同条件で **42px** と僅かに未達 |
| D10 | prefers-reduced-motion 対応 | ⚠️ | `index.css:266` にブロックあり。`scroll-behavior: auto` が抜けている。また背景グラデーションが常時アニメーションしており、**設定で明示的に切る手段がアプリ内に無い** |
| D11 | 提示モード | ❌ | 未実装。フルスクリーンボタンも無し |
| D12 | 印刷CSS | ❌ | `@media print` 0 件 |
| D13 | color-scheme の明示 | ❌ | `<meta name="color-scheme">` も CSS の `color-scheme` も無し。暗い配色のアプリなのに OS が明色と解釈し、名前入力欄などのネイティブ UI が白浮きしうる |
| D14 | forced-colors（ハイコントラスト） | ❌ | 記述 0 件。背景色が無効化されると 3D ボタンの立体感が消え、押せることが分からなくなる |

---

## E. PWA（Part I §3）

| # | 項目 | 判定 | 実測 |
|---|---|:--:|---|
| E1 | manifest の id/scope/start_url がリポジトリ名絶対パス | ❌ | **最優先。** ビルド後の `dist/manifest.webmanifest` は `"start_url":"."`, `"scope":"."`、**`id` が存在しない**。`id` 省略時は解決後の `start_url` が代替の識別子になるため、URL の些細な違いで別アプリ扱いになる。同一オリジンに数十個のアプリが同居する `gigayama.github.io` では事故域 |
| E2 | アイコン4種 + apple-touch-icon | ⚠️ | `pwa-192`(any) / `pwa-512`(any) / `pwa-maskable-512`(maskable) / `apple-touch-icon` の4点。**`maskable-192` が欠落**（Android の一部ランチャーが 192 の maskable を要求する） |
| E3 | beforeinstallprompt を head 最上部で捕捉 | ❌ | `beforeinstallprompt` の記述 0 件 |
| E4 | インストールボタンをアプリ内に設置 | ❌ | 未設置。README に手順の記載はあるが、アプリ内導線が無い |
| E5 | sw.js が自アプリ接頭辞のキャッシュのみ削除 | ⚠️ | `vite-plugin-pwa`(Workbox) 生成。`cleanupOutdatedCaches()` は Workbox 自身のプリキャッシュのみを対象とするため**他アプリは壊していない**。ただし `cacheId` 未設定で、ランタイムキャッシュ名 `google-fonts-stylesheets` / `google-fonts-webfonts` に**アプリ接頭辞が無く、同一オリジンの他アプリと共有される** |
| E6 | sw.js が localStorage に触れていない | ✅ | `dist/sw.js` に `localStorage` の出現 0 件 |
| E7 | 更新通知 | ❌ | `registerType: 'autoUpdate'`（`vite.config.ts:13`）。黙って差し替わるだけで、児童に伝わる更新通知が無い |
| E8 | offline.html | ❌ | 存在しない |
| E9 | APP_VERSION を今回のリリース値に更新 | ⚠️ | `package.json` の `version` は `1.0.0` のまま。Workbox はファイルハッシュで版管理するため実害は小さいが、リリース識別子として運用されていない |
| E10 | iOS の「ホーム画面に追加」手順を MANUAL に記載 | ❌ | MANUAL.md 自体が無い（README には1行あり） |

---

## F. アクセシビリティ・性能

| # | 項目 | 判定 | 実測 |
|---|---|:--:|---|
| F1 | alt / aria-label / aria-live | ⚠️ | `<img>` が無いので `alt` は該当なし。アイコンボタンには `aria-label` あり（良い）。**`aria-live` が 0 件**で、投票結果・占い結果・勝敗といった状態変化が読み上げられない |
| F2 | キーボードのみで全機能に到達 | ⚠️ | すべて `<button>` / `<input>` なので Tab 到達自体は可能。ただし **`:focus-visible` の可視スタイルが未定義**（`outline` 指定なし）で、どこにフォーカスがあるか分からない。モーダルもフォーカスを閉じ込めておらず、Esc でも閉じない |
| F3 | 初回JS 300KB以下 | ✅ | `dist/assets/index-BBL-iZqE.js` = **193.08 KB**（gzip 59.10 KB） |
| F4 | 1ファイル 5,000行 / 400KB 以内 | ✅ | 最大は `src/App.tsx` = **1,250行 / 64,509 B** |
| F5 | 総アセット（初回）1MB以下 | ⚠️ | プリキャッシュ **623.37 KiB**。上限内だが、その **約 60% がアイコン画像**（下表）。加えて Web フォントは外部 CDN のため未計上 |
| F6 | 画像サイズの上限 | ❌ | `favicon.png` **92,613 B**（上限 30KB）／`pwa-512x512.png` **121,923 B**（上限 60KB）／`pwa-maskable-512x512.png` **129,301 B**（上限 60KB）。`pwa-192x192.png` 32,596 B と `apple-touch-icon.png` 26,786 B は許容 |
| F7 | フォント配信 | ❌ | `src/index.css:1` で `@import url('https://fonts.googleapis.com/...')`。**外部 CDN 依存**（Part IV 禁止事項）。初回オフラインで本文フォントが当たらず、CSS 内 `@import` のため描画開始も遅れる |

---

## G. 学習ログ（学習系のみ）

| # | 項目 | 判定 | 実測 |
|---|---|:--:|---|
| G1 | study.v1 準拠・個人情報を持たない | — | 該当なし。学習アプリではなく（成績・正誤を記録しない）、`localStorage` 使用 0 件。プレイヤー名も端末内メモリのみで、リロードで消える |
| G2 | 中断記録・5分ルール | — | 同上 |

---

## ❌ の一覧と対処方針

| 項目 | 対処フェーズ |
|---|---|
| A1 LICENSE 無し / A3 dependabot 無し | **P0** |
| A2 `.env` 除外指定 | **P0** |
| D6 320px で内容が欠ける | **P1** |
| D9 タップ領域 44px 未満・`touch-action` 無し | **P1** |
| D2 `dvh` フォールバック無し / D3 左右セーフエリア | **P1** |
| D10 動きを切る手段がアプリ内に無い | **P1** |
| D11 提示モード無し | **P1** |
| D12 印刷CSS 無し | **P1** |
| D13 `color-scheme` 未宣言 / D14 `forced-colors` 未対応 | **P1** |
| D8 コントラスト未達 | **P1** |
| E1 manifest の `id`/`scope`/`start_url` | **P1（最優先）** |
| E2 `maskable-192` 欠落 | **P1** |
| E3 / E4 インストール導線 | **P1** |
| E5 ランタイムキャッシュ名にアプリ接頭辞が無い | **P1** |
| E7 更新通知 / E8 `offline.html` / E9 版番号 | **P1** |
| F1 `aria-live` 無し / F2 フォーカス可視化・モーダル | **P1** |
| F7 フォント外部 CDN / B1 CSP 無し | **P1**（フォント自己ホスト化 → CSP 投入の順） |
| F6 アイコン容量超過 | **P2** |
| A4 MANUAL.md 無し・README の不足節 | **P3** |
| 品質ゲート・テスト無し | **P4** |
| B6 `esbuild` / `sharp`（メジャー更新が必要） | **見送り。理由を README に明記** |

## 判定を保留し、人間の確認を仰ぐ点

1. **`base: './'`（相対パス）と manifest 絶対パスの両立**
   現行は「カスタムドメインでも動くように」相対パスで統一されている。しかし Part I §3-1 は
   `id`/`scope`/`start_url` をリポジトリ名の絶対パスにすることを最優先で求めている。
   → **アセットは相対のまま、manifest の識別子3点のみ `/Werewolf/` の絶対パスにする**方針で進める。
   カスタムドメインへ移す予定がある場合は、この3点を書き換える必要がある。
2. **提示モード（D11）でのプレイヤー名の伏せ字**
   Part I §2-11 は「児童名は提示モードで既定は非表示」と定める。しかし本アプリは**名前を見て投票する**ため、
   伏せ字にするとゲームが成立しない。→ **伏せ字にはせず、代わりに「役職確認」「夜の行動」という
   秘密が漏れる画面では提示モード自体を自動で無効化する**方針で進める。
3. **アイコンの画質**（P2 で 122KB → 60KB 以下に圧縮）は、before/after を提示して確認を仰ぐ。

---
---

# ✅ 改修後の監査（P0〜P4 実施後 / 2026-08-03）

上の表は **改修前** の実測である。P0〜P4 を実施したあとの状態を、同じ項目で測り直した。

判定は `npm run check`（`scripts/check-project.mjs`）で機械的に再現できる。
目視でしか分からない項目（コントラスト・実機の見え方）は、実ブラウザ（Chromium）での
確認結果を記載している。

## A. 法務・配布

| # | 項目 | 判定 | 実測 |
|---|---|:--:|---|
| A1 | LICENSE 実ファイル | ✅ | MIT / Copyright (c) 2026 GIGAyama |
| A2 | .gitignore | ✅ | `.env` `.env.*` `.clasp.json` `.assets-original/` を追加 |
| A3 | dependabot.yml | ✅ | monthly（npm + github-actions）。メジャー更新は自動 PR の対象外 |
| A4 | README.md / MANUAL.md 両方 | ✅ | MANUAL.md を新規作成。README に3節を追記 |

## B. セキュリティ

| # | 項目 | 判定 | 実測 |
|---|---|:--:|---|
| B1 | CSP（connect-src が最小） | ✅ | `default-src 'none'` 起点で全て `'self'`。ワイルドカード・`unsafe-*` ともに 0 |
| B2 | 秘密情報・IDの直書きなし | ✅ | 変更なし（元から無し） |
| B3 | OAuthスコープ最小 | — | 該当なし |
| B4 | postMessage の宛先が `*` でない | ✅ | 未使用 |
| B5 | サーバー側5段ガード | — | 該当なし |
| B6 | 依存の脆弱性 | ⚠️ | 6件 → **4件**。残りはメジャー更新が必要なため見送り（理由は上の B6 と README）|

## C. 堅牢性

| # | 項目 | 判定 | 実測 |
|---|---|:--:|---|
| C4 | 通信失敗時のリトライと明示 | ✅ | 外部通信が 0 件になった。圏外時は `offline.html` を用意 |
| C5 | localStorage.clear() を使っていない | ✅ | 未使用 |
| C6 | localStorage のキー | ✅ | `werewolf.settings.v1` のみ（アプリ接頭辞つき） |

## D. 表示

| # | 項目 | 判定 | 実測 |
|---|---|:--:|---|
| D1 | viewport に viewport-fit=cover | ✅ | あり |
| D1b | 拡大の禁止 | ⚠️ | `user-scalable=no` を意図して残置。理由を `quality.config.json` の exceptions に明記 |
| D2 | 100dvh を使用（100vh 単独でない） | ✅ | `.app-shell` に `100vh` → `100dvh` のフォールバックを追加 |
| D3 | safe-area-inset を適用 | ✅ | 上下左右すべて（左右は `.app-shell` のパディング） |
| D4 | clamp() による fluid type | ✅ | 変更なし（元から良好） |
| D5 | Canvas の DPR 補正 | — | Canvas 未使用（`getContext(2d)` 0 件を機械的に確認） |
| D6 | 320px 幅で横スクロールが出ない | ✅ | 実ブラウザで `scrollWidth == clientWidth == 320`、はみ出し要素 0 |
| D6b | **縦スクロールができる** | ✅ | 後述の追加修正。4端末 × 9画面すべてで、末尾まで到達できることを実測 |
| D7 | 画像に width/height | — | `<img>` 0 件（アイコンは SVG） |
| D8 | コントラスト 4.5:1 以上 | ✅ | フッター `/50`→`/75`、死亡プレイヤー名 `/40`→`/65` に引き上げ |
| D9 | タップ領域 44px 以上・touch-action | ✅ | 実ブラウザで 44px 未満のボタン 0 件。`touch-action: manipulation` を全操作要素へ |
| D10 | prefers-reduced-motion 対応 | ✅ | `scroll-behavior` を追加。さらにアプリ内トグル「うごきをへらす」を新設 |
| D11 | 提示モード | ✅ | 「大きく表示」＋フルスクリーン。**秘密画面（役職確認・夜）では自動的に無効化** |
| D12 | 印刷CSS | ✅ | A4 縦。背景・操作系を落として白地黒字に |
| D13 | color-scheme の明示 | ✅ | `color-scheme: dark`（暗い配色に固定したアプリのため） |
| D14 | forced-colors | ✅ | ボタン枠・パネル枠・グラデーション文字を補正 |

## E. PWA

| # | 項目 | 判定 | 実測 |
|---|---|:--:|---|
| E1 | manifest の id/scope/start_url | ✅ | `id=/Werewolf/` `scope=/Werewolf/` `start_url=/Werewolf/?source=pwa` |
| E2 | アイコン4種 + apple-touch-icon | ✅ | any 2 / maskable 2 / apple-touch-icon |
| E3 | beforeinstallprompt を head 最上部で捕捉 | ✅ | `<head>` の**最初の script**（`public/pwa-install-hook.js`） |
| E4 | インストールボタンをアプリ内に設置 | ✅ | ヘッダーに設置。iOS には「ホーム画面に追加」の手順を表示 |
| E5 | sw.js が自アプリ接頭辞のキャッシュのみ削除 | ✅ | `cacheId: 'werewolf'`。実ブラウザでキャッシュ名 `werewolf-precache-v2-…` のみを確認 |
| E6 | sw.js が localStorage に触れていない | ✅ | `dist/sw.js` に出現 0 件 |
| E7 | 更新通知 | ✅ | `registerType: 'prompt'` +「あたらしい バージョンが あります」の帯 |
| E8 | offline.html | ✅ | アプリと同じ配色・同じ書体。JS を使わない |
| E9 | APP_VERSION の更新 | ✅ | `package.json` の `version` を 1.0.0 → 1.1.0 |
| E10 | iOS の手順を MANUAL に記載 | ✅ | MANUAL.md §4、アプリ内の「あそびかた」にも表示 |

## F. アクセシビリティ・性能

| # | 項目 | 判定 | 実測 |
|---|---|:--:|---|
| F1 | alt / aria-label / aria-live | ✅ | 状態変化（犠牲者・投票結果・占い結果・勝敗）に `aria-live="polite"` |
| F1b | ルビの `<rp>` | ✅ | 追加（読み上げの二重読み対策） |
| F2 | キーボードのみで全機能に到達 | ✅ | `:focus-visible` を可視化。モーダルは Esc で閉じ、Tab を閉じ込める |
| F3 | 初回JS 300KB以下 | ✅ | **205.6 KB**（gzip 63.0 KB） |
| F4 | 1ファイル 5,000行 / 400KB 以内 | ✅ | 最大 `src/App.tsx` 1,232行 / 65 KB |
| F5 | 総アセット 1MB以下 | ✅ | **547.4 KB**（623 KB から削減。しかもフォントを内包したうえで） |
| F6 | 画像サイズの上限 | ✅ | 426 KB → **69 KB**。上限チェックを生成スクリプトに内蔵 |
| F7 | フォント配信 | ✅ | 自己ホスト（woff2 のみ・サブセット 196 KB）。**外部オリジンへの通信 0 件** |

## G. 学習ログ

| # | 項目 | 判定 | 実測 |
|---|---|:--:|---|
| G1 / G2 | study.v1 | — | 該当なし（成績・正誤を記録しないアプリ） |

## 品質ゲート

```
合格 38 / 該当なし 2 / 例外として許可 1 / 不合格 0
```

例外として明示的に許可した 1 件：

| 項目 | 理由 |
|---|---|
| `viewport-scalable`（`user-scalable=no`） | 全画面が児童の操作対象で、タブレットを回して渡すあいだの誤ズームがそのままゲームの中断になる。Part I §2-1 が児童画面に限って認めている指定 |

`npm audit` の残り 4 件は、ゲート項目ではなく CI の「報告のみ」ステップとして扱っている。

## 残っている ❌ と、その理由

**❌ は 0 件。** ⚠️ が 2 件あり、いずれも意図した判断である。

| 項目 | 状態 | 判断 |
|---|---|---|
| B6 依存の脆弱性 4件 | ⚠️ | `esbuild`(←`vite`) と `sharp`。**メジャー更新でしか解消できない**ため、改修モードの規則に従って見送った。どちらも開発時にしか動かず、配信物 `dist/` には含まれない |
| D1b `user-scalable=no` | ⚠️ | 上記のとおり、意図して残置 |

## 人間に確認してほしいこと

1. **アイコンの画質**（426KB → 69KB）
   元画像と圧縮後を画素単位で比べたところ、差が出たのは全サブピクセルの 3.9%、
   最大差 39/255・平均差 5.8/255 で、すべて輪郭のアンチエイリアス部分だった。
   このアイコンは赤と黒のドット絵で階調を持たないため、肉眼での差は無いと判断している。
   実機での見え方を一度確認してほしい。

2. **`manifest.id` を `/Werewolf/` に固定したこと**
   これまで `id` は省略されており、解決後の `start_url`（＝`https://gigayama.github.io/Werewolf/`）
   が代替の識別子として使われていた。今回明示した `/Werewolf/` は**同じ値に解決される**ため、
   すでにインストール済みの端末が「別アプリ」になることはない。
   ただし、**カスタムドメインへ移す予定がある場合は `vite.config.ts` の `REPO_BASE` の
   書き換えが必要**になる（アセット自体は相対パスのままなので影響しない）。

3. **フォントのサブセット**
   ひらがな・カタカナは全字入っているため、児童が入力する名前は基本的に問題ない。
   収録外の漢字は端末内蔵フォントに落ちる（`unicode-range` の働きで□にはならない）が、
   **書体が変わって見える**。学級の実データで一度確認してほしい。

---

# 🐛 追加修正：ページがスクロールできなかった問題（2026-08-03 報告）

「スクロールができず、ゲーム開始ボタンが画面内に出せないので始められない」という報告を受けて調査した。
**改修前（公開中の版 `a8116ba`）から存在していた既存のバグ**である。改修で持ち込んだものではない
（同じ計測を改修前のビルドに対しても実施し、まったく同じ結果になることを確認した）。

## 何が起きていたか

`body { overflow: hidden }` と高さ固定の `.app-shell`、そして内側の `<main overflow-y-auto>` という
組み合わせのせいで、**ドキュメント自体が1ピクセルも動かない**構造になっていた。
スクロールできるのは `<main>` だけで、しかもその `<main>` は誰もフォーカスしない。結果、

| 操作 | 改修前 |
|---|---|
| ホイール／スワイプ | 動く |
| **スクロールバーを掴む** | **不可**（`::-webkit-scrollbar { width: 0px }` で完全に非表示） |
| **スペースキー** | **効かない**（ドキュメントを送ろうとするが、ドキュメントは動かない） |
| **ピンチで引いて全体を見る** | **不可**（`user-scalable=no`） |
| ブラウザの検索で画面外の語へ飛ぶ | 効かない |

つまり「バーも見えない・キーも効かない・引いて見ることもできない」状態で、
1366×768 の Chromebook でも開始ボタンは 2,264px 下にあった。**スクロールできないと受け取られて当然**である。

## 直したこと

1. **ドキュメントをスクロールさせる**
   `body` の `overflow: hidden` を外し、`.app-shell` を `height` から `min-height` に変えた。
   中身が画面より高いときは器のほうが伸びる。
   ※ `body` に `overflow-x: hidden` も付けていない。付けると `overflow-y` が `auto` に化けて
   `body` 自身がスクロール箱になり、ヘッダーの `position: sticky` が効かなくなるため。

2. **入れ子のスクロール領域を全部やめた**
   `main` / ScreenLayout の中身 / 名前一覧 / 投票グリッド / 生存者一覧 / 結果一覧の
   `overflow-y-auto` を外し、素直に中身の高さで伸びるようにした。
   スクロールする箱はモーダルの中の1か所だけになった（そこには `.scroll-area` を付けて
   `overscroll-behavior: contain` を明示）。

3. **スクロールバーを見えるようにした**
   `width: 0px` をやめ、細く目立たない見た目で必ず出るようにした。
   設定画面は縦に画面3枚ぶんあり、下端に開始ボタンがある。**続きがあることが見えないと詰む。**

4. **ヘッダーを `sticky top-0` に**
   スクロールしても、音・うごき・提示モード・あそびかたの操作を失わない。

5. **背景（星・雲）を `fixed` に**
   ページが画面より高くなったときに、背景だけ一緒に流れていかないようにした。

### 見送ったこと

開始ボタンを画面下端に貼り付ける（`position: sticky`）案も試したが、**取りやめた**。
スクロールの途中で人数ボタンや名前の入力欄の上に重なり、そちらを押したつもりが
開始ボタンに吸われる。実際、自動テストで「12人」を押したはずが開始ボタンが反応した。
ページがふつうにスクロールするようになった以上、割に合わない。

## 検証（実ブラウザ / Chromium）

4端末サイズ × 9画面（setup / setup(12人) / roleCheck / roleCheck(公開) / day / day(タイマー) /
vote / voteResult / night）を通しで操作し、全 36 通りで次を確認した。

- **末尾まで到達できる**（`End` キーで文書の最下部に届く）
- **横あふれが無い**（`scrollWidth == clientWidth`）
- **44px 未満のボタンが無い**
- **コンソールエラー 0件**

| 端末 | 設定画面(12人)の文書高 | 画面高 | 末尾到達 |
|---|---|---|---|
| iPhone SE 320×568 | 2,250px | 568px | ✅ |
| iPhone 12 390×664 | 2,169px | 664px | ✅ |
| iPad 810×1080 | 3,032px | 1,080px | ✅ |
| Chromebook 1366×768 | 3,032px | 768px | ✅ |

キーボード操作（1366×768）：`Space` → 672px、`PageDown` → 1,344px、`End` → 最下部、`Home` → 先頭。
最下部までスクロールしてもヘッダーは `top=0` に残り、「ゲーム開始」ボタンは画面内に見えている。

---

# 追加修正（2026-08-23）— プライバシーポリシー / 利用規約が開けない

## 何が起きていたか

giga-school.com 側からプライバシーポリシーと利用規約のボタンを押すと、
そのページではなく**人狼ゲームのアプリ画面が開いてしまう**状態だった。

原因は2つ重なっていた。

1. **ページが配信されていなかった。**
   `privacy.html` と `terms.html` はリポジトリの直下に置かれていたが、
   GitHub Pages へ上げているのは `dist/` だけ（`.github/workflows/deploy.yml` の
   `upload-pages-artifact` の `path: ./dist`）。Vite が `dist/` へそのまま複製するのは
   `public/` の中身だけなので、この2ファイルは配信物に**1度も入っていなかった**。

2. **Service Worker が肩代わりしていた。**
   Workbox の `navigateFallback: 'index.html'` は、画面遷移のリクエストを
   すべてプリキャッシュ済みの `index.html` に差し替える（圏外でもアプリが
   起動するための設定）。存在しない `/privacy.html` への遷移もこれに拾われるため、
   404 ではなく**アプリが立ち上がる**という見え方になっていた。

## どう直したか

1. `privacy.html` と `terms.html` を `public/` へ移した。
   これで `dist/privacy.html` / `dist/terms.html` として配信される。

2. `vite.config.ts` の Workbox 設定に `navigateFallbackDenylist` を足し、
   この2ページを画面遷移フォールバックの対象から外した。

   ```ts
   navigateFallback: 'index.html',
   navigateFallbackDenylist: [/\/(privacy|terms)\.html$/],
   ```

   1 だけでは不十分である。`navigateFallback` は存在するファイルへの遷移も
   差し替えるため、除外しないと配信物に入れても**やはりアプリが開く**。

## 検証

- `npm run typecheck` / `npm test`（35件）/ `npm run build` / `npm run check`（38合格・0不合格）
- `dist/` を静的配信し、`/privacy.html` と `/terms.html` が 200 で
  それぞれ「プライバシーポリシー｜Werewolf」「利用規約｜Werewolf」を返すことを確認
- 生成された `dist/sw.js` に
  `NavigationRoute(…,{denylist:[/\/(privacy|terms)\.html$/]})` が入っていることを確認
- 配信物の合計は 573.4KB（上限 1024KB）。2ページ分（約21KB）増えたが余裕がある

なお、この2ページは `globPatterns` の `**/*.html` に合致するのでプリキャッシュされる。
オフラインでも読める。
