// ==========================================================================
// external-origins.mjs — 配信物が外部オリジンから「読み込む」ものを見つける
// ==========================================================================
// なぜ分けてあるか:
//   F7 はもともと「HTML と CSS に出てくる http(s):// を全部あつめる」形で、
//   og:url / og:image のようなメタデータまで「外部オリジンへの通信」として
//   数えていた。2026-08-21 に OGP タグを入れた結果、自分自身のアドレス
//   （werewolf.giga-school.com と giga-school.com）で赤くなり、
//   deploy.yml が push:main でしか走らないため PR は緑のまま main で落ちて、
//   そこから2コミット分が本番に出ないままになった。
//
//   誤検知は本物の指摘を埋もれさせるので、ここは「ブラウザが実際に取りに行く
//   ものだけ」を見る。判定を検査本体から切り離してあるのはテストするため。
//
// 何を見るか（＝校内フィルタで塞がれるとアプリが黙って壊れるもの）:
//   script src / link rel=stylesheet・preload・modulepreload /
//   img・source・video・audio・track の src と srcset /
//   iframe・embed の src / object data /
//   CSS の url(...) と @import / JS の fetch・Worker・importScripts
//
// 何を見ないか（＝取りに行かないので塞がれても壊れない）:
//   <a href>           … 利用者が押したときの遷移。ページの読み込みではない
//   rel=canonical      … 検索エンジンへの申告
//   og:* / twitter:*   … SNS のクローラが読むもの。端末は取りに行かない
// ==========================================================================

/** 属性値を1つ取り出す。値は " ' 無しのいずれでも書ける */
function attr(tag, name) {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  if (!m) return null;
  return m[2] ?? m[3] ?? m[4] ?? null;
}

/** srcset は「URL 幅, URL 幅」の形なので、URL だけを取り出す */
function fromSrcset(value) {
  return String(value || '')
    .split(',')
    .map((part) => part.trim().split(/\s+/)[0])
    .filter(Boolean);
}

/** 絶対 URL ならホスト名を返す。相対パスや data: なら null */
export function hostOf(url) {
  const m = String(url || '').trim().match(/^(?:https?:)?\/\/([^/?#'"\s]+)/i);
  return m ? m[1].toLowerCase() : null;
}

/**
 * HTML から「ブラウザが取りに行く」URL を集める。
 * @param {string} html
 * @returns {string[]} URL の一覧（相対も含む。ホスト判定は呼び出し側）
 */
export function loadedUrlsInHtml(html) {
  const urls = [];
  const src = String(html || '');

  for (const m of src.matchAll(/<([a-z0-9-]+)\b[^>]*>/gi)) {
    const tag = m[0];
    const name = m[1].toLowerCase();

    if (name === 'link') {
      const rel = (attr(tag, 'rel') || '').toLowerCase();
      // 取りに行く rel だけ。canonical / alternate / author などは見ない
      const fetched = ['stylesheet', 'preload', 'modulepreload', 'prefetch', 'preconnect', 'dns-prefetch'];
      if (!fetched.some((r) => rel.split(/\s+/).includes(r))) continue;
    }

    // 見る属性はこの4つだけ。ここで自然に落ちるもの:
    //   <meta og:* content=…>  … content を見ないので落ちる（クローラ向け）
    //   <a href=…> / <area>    … href を見るのは link だけなので落ちる（遷移であって読み込みではない）
    for (const a of ['src', 'href', 'data', 'poster']) {
      if (a === 'href' && name !== 'link') continue;
      const v = attr(tag, a);
      if (v) urls.push(v);
    }
    const srcset = attr(tag, 'srcset') || attr(tag, 'imagesrcset');
    if (srcset) urls.push(...fromSrcset(srcset));
  }

  // インラインの <script> の中身も、外から取ってくる書き方だけ拾う
  for (const m of src.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    urls.push(...loadedUrlsInJs(m[1]));
  }
  return urls;
}

/** CSS から取りに行く URL を集める */
export function loadedUrlsInCss(css) {
  const urls = [];
  const src = String(css || '');
  for (const m of src.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi)) urls.push(m[1]);
  for (const m of src.matchAll(/@import\s+['"]([^'"]+)['"]/gi)) urls.push(m[1]);
  return urls;
}

/** JS から取りに行く URL を集める（文字列リテラルで直に書いてあるものだけ） */
export function loadedUrlsInJs(js) {
  const urls = [];
  const src = String(js || '');
  const pats = [
    /\bfetch\(\s*['"`]([^'"`]+)['"`]/g,
    /new\s+Worker\(\s*['"`]([^'"`]+)['"`]/g,
    /\bimportScripts\(\s*['"`]([^'"`]+)['"`]/g,
    /\.open\(\s*['"`][A-Z]+['"`]\s*,\s*['"`]([^'"`]+)['"`]/g,
    /\bimport\(\s*['"`]([^'"`]+)['"`]/g,
  ];
  for (const p of pats) for (const m of src.matchAll(p)) urls.push(m[1]);
  return urls;
}

/**
 * 配信物が外部オリジンから読み込んでいるホストの一覧。
 * @param {Array<{path: string, text: string}>} files
 * @returns {string[]} ホスト名（重複なし・並び順は安定）
 */
export function externalHosts(files) {
  const hosts = new Set();
  for (const { path, text } of files || []) {
    const ext = (path.match(/\.([a-z0-9]+)$/i) || [])[1]?.toLowerCase();
    const urls =
      ext === 'css' ? loadedUrlsInCss(text)
      : ext === 'js' || ext === 'mjs' ? loadedUrlsInJs(text)
      : loadedUrlsInHtml(text);
    for (const u of urls) {
      const h = hostOf(u);
      if (h) hosts.add(h);
    }
  }
  return [...hosts].sort();
}
