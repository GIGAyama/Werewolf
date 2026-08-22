// scripts/lib/external-origins.mjs の型。
// 本体は検査スクリプト（Node で動く素の .mjs）だが、テストは TypeScript なので
// 型が無いと npm run typecheck が落ちる。実装と一緒にここも直すこと。
export declare function hostOf(url: string): string | null;
export declare function loadedUrlsInHtml(html: string): string[];
export declare function loadedUrlsInCss(css: string): string[];
export declare function loadedUrlsInJs(js: string): string[];
export declare function externalHosts(
  files: Array<{ path: string; text: string }>
): string[];
