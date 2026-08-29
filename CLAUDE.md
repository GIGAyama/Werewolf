# CLAUDE.md

@.agents/rules/gigaschool-standards.md

⚠️ **上の 1 行を消さないこと。** 艦隊共通のルール（Zero-CDN・Zero-PII・正本同期）は
正本 `GIGAyama.github.io/standards/agents/rules/` に 1 本だけ置いてある。
Claude Code はこの取りこみを通して読む。以下はこのリポジトリ固有の話。

このファイルは、AI アシスタント（Claude Code など）がこのリポジトリで作業するときの手引きです。
人間向けの説明は [README.md](./README.md)（開発者向け）と [MANUAL.md](./MANUAL.md)（先生向け）にあります。

---

## 1. このアプリは何か

小学生・タブレット向けの**人狼ゲーム**。React + TypeScript + Vite の SPA で、GitHub Pages
（`https://werewolf.giga-school.com/`）に静的配信している。

前提として押さえておくべき性質が4つある。ほとんどの設計判断はここから来ている。

| 性質 | 何が導かれるか |
|---|---|
| **サーバーを持たない** | 通信先が無い。個人情報が端末外へ出る経路が存在しない。CSP は全ディレクティブ `'self'` / `'none'` |
| **1台の端末を回して遊ぶ** | 「役職の確認」「夜の行動」は**ひとりだけがのぞく画面**。ここでの表示の扱いを間違えるとゲームが壊れる |
| **利用者が小学生** | 全漢字にふりがな（ルビ）。タップ領域は 44px 以上。授業中に表示が勝手に変わってはいけない |
| **校内 Wi-Fi で 40台同時** | 配信量に上限がある（初回 JS 300KB / 総アセット 1MB）。外部 CDN を使わない |

UI 文言・コード内コメント・ドキュメントはすべて**日本語**。新しく書くものも日本語に揃えること。

---

## 2. コマンド

Node.js 18 以上（CI は 20、ローカル検証は 22 で動作確認済み）。

```bash
npm ci            # 依存のインストール（package-lock.json どおりに入れる）
npm run dev       # 開発サーバー（HMR）
npm run typecheck # tsc -b --noEmit
npm test          # vitest run（tests/game.test.ts、20 tests）
npm run build     # tsc -b && vite build → dist/
npm run check     # 品質ゲート（★ 先に npm run build が必要）
npm run preview   # dist/ をローカル配信
```

生成系（必要なときだけ手で回す。CI では走らない）:

```bash
npm run icons     # assets/icon-master.png → public/*.png（容量上限を超えたら exit 1）
npm run fonts     # ソースから文字を拾ってサブセット取得 → public/fonts/ と src/fonts.css
```

### 変更を出す前に必ず通す4つ

```bash
npm run typecheck && npm test && npm run build && npm run check
```

CI（`.github/workflows/deploy.yml`）がこの順で走り、どれかが落ちると公開されない。
`npm run check` は `dist/` を読むので、**ビルドし直さずに実行すると古い結果を見て嘘の合格を出す**。

---

## 3. ディレクトリ構成

```
index.html                <head> の最初で beforeinstallprompt を捕まえる（順序に意味がある）
vite.config.ts            base / CSP 注入 / PWA manifest / Workbox。REPO_BASE がここ
quality.config.json       品質ゲートの閾値・機能フラグ・例外
tsconfig.json             strict + noUnusedLocals/Parameters。include は src と tests

src/
  main.tsx                エントリ（React.StrictMode）
  App.tsx                 画面とゲーム進行。UI・音・フェーズ遷移をすべて持つ（約1350行）
  game.ts                 画面に依存しない中核ロジック（配役・勝敗判定）★テスト対象
  settings.ts             音・うごきの設定（localStorage）
  pwa.ts                  インストール導線と Service Worker 更新通知
  index.css               表示の土台（fluid type・セーフエリア・提示モード・印刷・動きの配慮）
  fonts.css               ★自動生成。直接編集しない（npm run fonts で作り直す）

tests/game.test.ts        game.ts のテスト
scripts/
  check-project.mjs       品質ゲート本体（GIGA Standard v4 の A〜G）
  generate-icons.mjs      sharp でアイコン生成＋容量上限チェック
  build-fonts.mjs         Google Fonts API からサブセット woff2 を取得して自己ホスト化

assets/icon-master.png    アイコンの元画像（無圧縮。Vite の対象外＝dist に入らない）
public/                   そのまま配信されるもの（生成済みアイコン・フォント・offline.html・install hook）

README.md                 開発者向け。設計の理由と制限が全部書いてある
MANUAL.md                 先生向け。専門用語を使わない操作手順
AUDIT.md                  品質監査の記録（改修前 → 改修後 → 追加修正）
ROLLOUT.md                他リポジトリへ同じ改修を展開するときの参考
```

---

## 4. アーキテクチャ

### 4-1. ロジックと画面の分離

`src/game.ts` には **JSX を返さない純粋なロジックだけ**を置く。ここが `App.tsx` から切り出されて
いるのは、テストを書けるようにするため。役職の配り方と勝敗の判定を間違えると「なぜか終わらない」
「勝っているはずなのに続く」という形で授業中に表に出て、その場では直せない。

```ts
ROLE_CONFIGS        // 4〜12人それぞれの既定の役職構成
VILLAGER_TEAM_ROLES // 村人・占い師・霊能者・狩人（狂人は含まない）
shuffleArray        // 非破壊シャッフル
createInitialState  // 配役・人狼の仲間情報・占い師の初日白を作る
checkForWinner      // 勝敗判定
```

**配役・勝敗・人数の数え方に手を入れたら、必ず `tests/game.test.ts` を足すか直すこと。**

とくに注意: **狂人は人狼陣営だが「人間の頭数」として数える**（`checkForWinner` は
`role !== '人狼'` を人間として数える）。占いでも白が出る。ここは取り違えやすいので
テストで固定してある（`tests/game.test.ts` の「狂人は…」）。

### 4-2. フェーズの状態機械

`GameState.phase` が画面そのもの。遷移はすべて `App.tsx` の `renderPhase()` の中にある。

```
setup → roleCheck → day → vote →(同数)→ vote(決選) → voteResult → night → day → …
                                                        ↓(勝敗確定)
                                                      result → setup
```

- 状態更新は `updateState((draft) => …)` のヘルパー経由。`draft` を直接書き換えるか
  `Partial<GameState>` を返すかのどちらでもよい。
- `gameMessage` / `nightActionResult` は `ReactNode`（ルビ付き JSX を入れるため）。
  `game.ts` の型は `ReactNode` を参照するが、値を作るのは `App.tsx` 側。
- 投票の集計・決選投票・ランダム決着は `handleVote` に、夜の解決は `handleMorning` に集約されている。

### 4-3. 秘密の画面（重要）

`roleCheck` と `night` は、**ひとりだけがのぞき込む画面**。

```ts
const isSecretPhase = gameState?.phase === 'roleCheck' || gameState?.phase === 'night';
const presentationActive = presentation && !isSecretPhase;
```

提示モード（文字を 140% に拡大）はこの2つのフェーズで**自動的に無効化**される。
拡大するとなりの席から役職が見えてゲームが壊れるため。ここを緩める変更は入れないこと。

### 4-4. 音（AudioManager）

`App.tsx` の static クラス。Web Audio API で SE を合成し、Web Speech API で読み上げる。

- iOS は最初のユーザー操作まで鳴らない。`Button` / `IconButton` の click で `AudioManager.init()` を呼んで解除している。
- 読み上げは**進行の補助**であって必須ではない。日本語音声が無い端末でも、画面の文字だけでゲームは完結する。
- ミュート状態は `settings.muted`（localStorage）と `AudioManager.isMuted`（static）の両方に持つ。片方だけ更新しないこと。

### 4-5. ふりがな（ルビ）

```tsx
const R = ({ t, r }: { t: string; r: string }) => (
  <ruby>{t}<rp>(</rp><rt>{r}</rt><rp>)</rp></ruby>
);
```

**画面に出す漢字には必ず `<R>` を付ける。** `<rp>` は省略しない — ルビ非対応環境での代替であると
同時に、読み上げソフトが本文とルビを続けて「じんろうじんろう」と二重に読むのを防ぐ目印になる
（品質ゲート F1b が検査する）。CSS で `rp` は非表示にしている。

---

## 5. 品質ゲート（GIGA Standard v4）

`npm run check` が `scripts/check-project.mjs` を走らせ、A〜G の項目を機械的に検査する。
**CI で落ちると公開されない。** 現状 38合格 / 2該当なし / 1例外 / 0不合格。

### 落ちたときの直し方

> **閾値を下げない。** 直すか、`quality.config.json` の `exceptions` に
> `check` / `reason` / `reviewedAt` を書いて明示的に許可すること。

現在の例外は2件（`npm-audit-clean`、`viewport-scalable`）。どちらも理由と判断日が入っている。

### 検査されている代表的な不変条件

これらは「守っている」ではなく「**破ると CI が赤くなる**」ものとして扱うこと。

| 項目 | 内容 |
|---|---|
| B1 | `dist/index.html` に CSP があり、`*` / `unsafe-inline` / `unsafe-eval` を含まない |
| B2 | APIキー・シートID・メールアドレスの直書きが無い |
| C5 | `localStorage.clear()` を**使わない**（同一オリジンの他アプリの記録まで消える） |
| C6 | localStorage のキーが `werewolf.` 接頭辞つき |
| D2 | `100vh` を単独で使わない（直前行に `100dvh` があるフォールバックとしてのみ可） |
| D3 | `safe-area-inset-{top,bottom,left,right}` を全方向に適用 |
| D4 | `font-size: clamp()` による fluid type |
| D9/D10/D13/D14 | `touch-action: manipulation` / `prefers-reduced-motion` / `color-scheme` / `forced-colors` |
| E1 | manifest の `id` / `scope` / `start_url` が `/Werewolf/` の絶対パス |
| E5/E6 | Workbox `cacheId` あり / SW が `localStorage` に触れない |
| F1/F1b/F2 | `aria-label`・`aria-live`・`aria-modal` / ルビの `<rp>` / `:focus-visible` の outline |
| F3/F4/F5/F6 | 初回 JS ≤300KB（現 205KB） / 1ファイル ≤5000行・400KB / 総アセット ≤1MB（現 548KB） / 画像の上限 |
| F7 | `index.html`・`index.css`・`fonts.css` に外部オリジンの URL が無い（note.com のリンクのみ除外） |

`scripts/check-project.mjs` は検査前にコメントを落とす（`stripComments`）。日本語コメントに
「`localStorage.clear()` は呼ばない」と書いてあるのを違反として拾わないための処理。
新しい検査を足すときも同じ関数を通すこと。

---

## 6. PWA まわりの落とし穴

### REPO_BASE（`vite.config.ts`）

```ts
const REPO_BASE = './';   // id / scope / start_url はここから組み立てる
```

独自ドメイン `werewolf.giga-school.com` へ移り、アプリはドメイン直下に置かれている。
アセットは相対パス（`base: './'`）で出るのでどこに置いても動き、manifest の
`id` / `scope` / `start_url` も `REPO_BASE` から組み立てて `"./"` にしてある。

⚠️ 旧構成（`gigayama.github.io/Werewolf/`）のように**リポジトリ名の絶対パスに戻さないこと。**
戻すと `scope` がページの URL を含まなくなり、manifest ごと無視されて
PWA としてインストールできなくなる。
`id` を省くのも不可。省くと解決後の `start_url` が代替の識別子になり、
URL を少し直しただけで別アプリ扱いになる。

- このリポジトリをコピーして別アプリを作るなら、まず `quality.config.json` の `repoBase` を書き換える。
- 配信場所を変えるときは `REPO_BASE` を配信場所に合わせる。
- **`id` を変えると、インストール済み端末では「別のアプリ」になる。**

### registerType は `'prompt'`（`autoUpdate` にしない）

授業のとちゅうで黙って表示が変わると児童が混乱する。新しい版が待機したら
「あたらしい バージョンが あります」の帯（`UpdateToast`）を出し、押されたときだけ切り替える。
品質ゲート E7 がこの文言と設定の両方を検査している。

**リリースのたびに `package.json` の `version` を上げること。**

### CSP はビルド時にだけ注入する

`vite.config.ts` の `injectCsp()` は `apply: 'build'`。開発サーバーは CSS を `<style>` で注入
するため、`index.html` に直書きすると**開発中だけ画面が真っ白になる**。
つまり `npm run dev` では CSP が効いていない。CSP に関わる確認は必ず `npm run build` の成果物で行う。

### `index.html` のスクリプト順序

`<head>` の**いちばん最初**が `./pwa-install-hook.js`。Chrome は条件が揃うと即座に
`beforeinstallprompt` を出すので、React や CSS より後ろに置くと合図を取りこぼして
インストールボタンが出なくなる。インラインではなく外部ファイルなのは、CSP の
`script-src 'self'` をハッシュ管理なしで成立させるため。品質ゲート E3 が順序を検査する。

---

## 7. CSS の約束ごと

`src/index.css` のコメントに、ほぼすべての判断理由が書いてある。改変前に該当箇所を読むこと。

- **`html { font-size: clamp(14px, 1.9vw + 6px, 20px) }` がレスポンシブの要。**
  Tailwind のサイズ指定はすべて rem 基準なので、これ一つで文字・余白・ボタンが端末幅に追従する。
  裏返すと、**rem 指定のタップ領域は狭い端末で 44px を割る**（`w-12` = 3rem × 14px = 42px）。
  ボタンの下限は `min-w-[44px] min-h-[44px]` のように **px の絶対値**で置くこと。
- **`body` に `overflow: hidden` を付けない。** 以前これでページ自体が動かなくなり、
  「スクロールできなくてゲーム開始ボタンに届かない」という不具合になった（AUDIT.md 末尾）。
  `overflow-x: hidden` も付けない（`overflow-y` が auto に化けて `position: sticky` が死ぬ）。
- **`.app-shell` は `height` ではなく `min-height`。** 中身が画面より高いときは器のほうが伸びて、
  ドキュメントごとスクロールさせる。
- `100dvh` の直前行に `100vh` を残す（古い ChromeOS / iOS 向けフォールバック）。品質ゲート D2 の想定する形。
- スクロールバーは消さない。細く（10px）して必ず見えるようにしてある。
- 動きの配慮は**2系統**ある：OS の `prefers-reduced-motion` と、アプリ内トグルが付ける
  `html.reduce-motion` クラス。片方だけ直さないこと。
- 生死などの状態は**色だけで伝えない**（ドクロ／取り消し線／`sr-only` の文字の3つで示す）。

---

## 8. フォントとアイコンの再生成

### フォント（`npm run fonts`）

Google Fonts の CSS API から `text=` パラメータでサブセット woff2 を取得し、`public/fonts/` と
`src/fonts.css` を書き出す。収録するのは「アプリのソースに出てくる文字＋かな全部＋
英数記号（半角/全角）＋小学1〜2年の配当漢字」で、現在 797字・2ウェイト計約196KB。

- **画面に新しい漢字を出したら実行する。**
- `src/fonts.css` は生成物。手で編集しない。
- ネットワークが必要（Google Fonts へ出る）。生成物は自己ホストなので、**配信物からは外部通信ゼロ**。
- 収録外の文字は `unicode-range` の働きで端末内蔵フォントへ落ちる。書体が変わるだけで**豆腐（□）にはならない**。
- 実行後は実機で見え方を確認するのが安全（README 参照）。

### アイコン（`npm run icons`）

`assets/icon-master.png`（無圧縮の元画像、Vite の対象外）から `public/` の6枚を生成する。
元画像と配信物を分けているのは、圧縮すると元に戻せなくなるため。
maskable は中央80%のセーフゾーンに収め、`apple-touch-icon` は iOS が maskable 非対応なので
余白と背景 `#050510` を焼き込む。**容量上限を超えたら exit 1 する。**

---

## 9. テスト

- テストは `tests/game.test.ts` の1本だけ。**`src/game.ts` の純粋ロジックのみを対象**にしている。
- UI の自動テストは無い。`App.tsx` を変えたら**実ブラウザでの手動確認が必要**。
  確認手順は ROLLOUT.md の「検証の手順」にチェックリストがある（320px 幅で横スクロールが出ない、
  manifest が読める、オフラインで起動する、コンソールに CSP 違反とエラーが 0件）。
- vitest は設定ファイルを持たず、`vite.config.ts` をそのまま使う。環境は node（DOM は使わない）。

---

## 10. Git / CI

- `main` への push で `.github/workflows/deploy.yml` が
  `npm ci` → `npm audit`（報告のみ・止めない）→ `typecheck` → `test` → `build` → `check` → Pages へデプロイ。
- `npm audit` に残る4件（`esbuild`←`vite`、`sharp`）は**意図的に未対応**。メジャー更新でしか
  解消できず、いずれも開発時にしか動かず `dist/` に含まれない。詳細は AUDIT.md の B6、
  例外の記録は `quality.config.json`。**勝手にメジャー更新しないこと。**
- 依存更新は Dependabot（`.github/dependabot.yml`）に任せる。
- コミットメッセージは日本語。「何を直したか」ではなく「**何が起きていて、どう直したか**」を書く。
  例: `fix(scroll): ページがスクロールできず、ゲーム開始ボタンに届かない問題を直す`
- 大きな改修は AUDIT.md に記録を追記する慣習になっている。

---

## 11. 変更するときのチェックリスト

- [ ] 画面に出す漢字に `<R t="…" r="…">` でふりがなを付けたか
- [ ] 新しいタップ対象の下限は **px の絶対値**で 44px 以上か
- [ ] `game.ts` を触ったなら `tests/game.test.ts` を足したか
- [ ] localStorage を足したなら `werewolf.` 接頭辞を付けたか（`clear()` は使わない）
- [ ] 外部オリジンへの参照を増やしていないか（CSP と F7 が落ちる）
- [ ] `roleCheck` / `night` の秘密性を損なう変更をしていないか
- [ ] `typecheck` → `test` → `build` → `check` を**この順で**通したか
- [ ] リリースなら `package.json` の `version` を上げたか
- [ ] `src/fonts.css` を手で編集していないか
