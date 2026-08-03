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
