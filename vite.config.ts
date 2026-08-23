import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// このリポジトリが GitHub Pages で公開されるパス。
// manifest の識別子（id / scope / start_url）は、ここから組み立てる。
// 独自ドメイン werewolf.giga-school.com の直下に置いているので "./"。
// リポジトリ名の絶対パス（旧 /Werewolf/）に戻すと、scope がページの URL を
// 含まなくなって manifest ごと無視され、インストールできなくなる。
// 理由は下の manifest のコメントを参照。
const REPO_BASE = './';

// ==========================================================================
// CSP（Content Security Policy）をビルド成果物の index.html にだけ差し込む。
//
// なぜビルド時だけか:
//   開発サーバー (npm run dev) は CSS を <style> タグとして注入するため、
//   style-src 'self' を index.html に直書きすると開発中だけ画面が真っ白に
//   なってしまう。配信物にだけ効かせるのが安全。
//
// なぜ全部 'self' で足りるか:
//   フォントを自己ホストにしたので、このアプリは外部オリジンへ一切通信しない。
//   ワイルドカードは1つも要らない。
// ==========================================================================
const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "font-src 'self'",
  "img-src 'self' data:",
  "manifest-src 'self'",
  // Service Worker のプリキャッシュ取得。同一オリジンのみ。
  "connect-src 'self'",
  "worker-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

function injectCsp() {
  return {
    name: 'inject-csp',
    apply: 'build' as const,
    transformIndexHtml(html: string) {
      // charset より後ろに置く（charset は先頭 1024 バイト以内が必須のため）
      return html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      );
    },
  };
}

// アセット自体は相対パス (`./`) で出力する。こうしておくと、
// プロジェクトページでもカスタムドメインでも、サブパスを気にせず動く。
export default defineConfig({
  base: './',
  plugins: [
    react(),
    injectCsp(),
    VitePWA({
      // 黙って差し替える autoUpdate はやめている。授業のとちゅうで表示が
      // 変わると児童が混乱するため、アプリ内で「あたらしい バージョンが
      // あります」と知らせて、押されたときだけ切り替える（src/pwa.ts）。
      registerType: 'prompt',
      // 登録は src/pwa.ts の registerSW() が行うので、自動注入は切る
      injectRegister: null,
      includeAssets: ['favicon.png', 'apple-touch-icon.png', 'offline.html'],
      manifest: {
        name: '人狼ゲーム',
        short_name: '人狼ゲーム',
        description:
          '小学生・タブレット向けの、1台の端末をみんなで回して遊ぶ人狼ゲーム。ふりがな・音声ガイド付きで、オフラインでも遊べます。',
        lang: 'ja',
        dir: 'ltr',

        // ⚠️ ここを相対パスにしてはいけない。
        // gigayama.github.io は数十個のアプリが同一オリジンを共有している。
        // id を省略すると解決後の start_url が代替の識別子になるため、URL を
        // 少し直しただけで別アプリ扱いになったり、似た構成の別アプリと
        // 取り違えられて「開いたら違うアプリが立ち上がる」事故が起きる。
        id: REPO_BASE,
        start_url: `${REPO_BASE}?source=pwa`,
        scope: REPO_BASE,

        display: 'standalone',
        display_override: ['standalone', 'fullscreen', 'minimal-ui'],
        launch_handler: { client_mode: ['navigate-existing', 'auto'] },
        orientation: 'any',
        background_color: '#050510',
        theme_color: '#050510',
        categories: ['games', 'entertainment', 'education'],
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'pwa-maskable-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // キャッシュ名にこの接頭辞が付く。同一オリジンに同居する他アプリの
        // キャッシュと混ざらず、掃除も自アプリ分だけで済む。
        cacheId: 'werewolf',
        globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2}'],
        // 画面遷移はプリキャッシュ済みの index.html を返す。圏外でも
        // アプリがそのまま起動する（offline.html はその保険）。
        navigateFallback: 'index.html',
        // ただし、プライバシーポリシーと利用規約はアプリではなく独立した
        // ページである。除外しないと Service Worker が画面遷移をすべて
        // index.html に差し替えてしまい、リンクを押してもアプリが開く。
        navigateFallbackDenylist: [/\/(privacy|terms)\.html$/],
        // 外部への runtimeCaching は持たない。フォントを自己ホストに
        // したので、このアプリはもう外部オリジンへ一切通信しない。
      },
    }),
  ],
  build: {
    target: 'es2019',
    cssTarget: 'chrome80',
  },
});
