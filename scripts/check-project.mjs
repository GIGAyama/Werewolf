// ==========================================================================
// GIGA Standard v4 品質ゲート
// 使い方: npm run check   （※ 先に npm run build を済ませておくこと）
//
// 監査表 (AUDIT.md の A〜G) のうち、機械的に確かめられる項目を検査する。
// 目視でしか分からないもの（コントラスト・実機での見え方・豆腐の有無）は
// ここでは扱わない。README / MANUAL に手順として残している。
//
// 検査を緩めたくなったときは、閾値を下げるのではなく quality.config.json の
// exceptions に「理由」と「いつ判断したか」を書いて、明示的に許可すること。
// ==========================================================================
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, extname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const cfg = JSON.parse(readFileSync(join(root, 'quality.config.json'), 'utf8'));
const dist = join(root, cfg.distDir);

const results = [];
const exceptionFor = (id) => cfg.exceptions.find((e) => e.check === id);

function check(id, label, fn) {
  let ok = false;
  let detail = '';
  try {
    const r = fn();
    ok = r === true || (r && r.ok);
    detail = (r && r.detail) || '';
  } catch (err) {
    ok = false;
    detail = err.message;
  }
  const ex = !ok && exceptionFor(id);
  results.push({ id, label, ok, detail, exception: ex || null });
}

function skip(id, label, why) {
  results.push({ id, label, ok: true, detail: `該当なし（${why}）`, skipped: true });
}

const read = (p) => readFileSync(join(root, p), 'utf8');
const bytes = (p) => statSync(join(root, p)).size;
const kb = (n) => `${(n / 1024).toFixed(1)}KB`;

/**
 * 検査する前にコメントを落とす。
 * このリポジトリのコメントには「localStorage.clear() は呼ばない」「100vh を
 * フォールバックに残す」といった説明が日本語で書いてあり、そのまま文字列検索を
 * かけると、禁止事項を守っている説明文そのものが違反として引っかかってしまう。
 */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ') // ブロックコメント（CSS / JS 共通）
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, '$1') // 行コメント（URL の // は除く）
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' '); // JSX コメント
}

/** node_modules と .git と dist を除いて、対象拡張子のファイルを列挙する */
function sourceFiles(exts) {
  const out = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (['node_modules', '.git', 'dist', '.assets-original'].includes(e.name)) continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (exts.includes(extname(e.name))) out.push(p);
    }
  };
  walk(root);
  return out;
}

const distExists = existsSync(dist);
const distHtml = distExists && existsSync(join(dist, 'index.html')) ? read(`${cfg.distDir}/index.html`) : '';
const manifest =
  distExists && existsSync(join(dist, 'manifest.webmanifest'))
    ? JSON.parse(read(`${cfg.distDir}/manifest.webmanifest`))
    : null;

// ==========================================================================
// A. 法務・配布
// ==========================================================================
check('license', 'A1 LICENSE が実ファイルで存在する', () => existsSync(join(root, 'LICENSE')));
check('gitignore-secrets', 'A2 .gitignore が .env を除外している', () => {
  const g = read('.gitignore');
  return { ok: /^\.env/m.test(g), detail: '' };
});
check('dependabot', 'A3 .github/dependabot.yml が存在する', () =>
  existsSync(join(root, '.github/dependabot.yml')),
);
check('docs', 'A4 README.md と MANUAL.md が両方ある', () => {
  const missing = ['README.md', 'MANUAL.md'].filter((f) => !existsSync(join(root, f)));
  return { ok: missing.length === 0, detail: missing.length ? `不足: ${missing.join(', ')}` : '' };
});
check('readme-sections', 'A5 README に セキュリティ設計 / 制限とクォータ / PWA の節がある', () => {
  const r = read('README.md');
  const missing = ['セキュリティ設計', '制限とクォータ', 'PWA'].filter((s) => !r.includes(s));
  return { ok: missing.length === 0, detail: missing.length ? `不足: ${missing.join(', ')}` : '' };
});

// ==========================================================================
// B. セキュリティ
// ==========================================================================
check('csp', 'B1 配信物に CSP があり、ワイルドカードを含まない', () => {
  const m = distHtml.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/);
  if (!m) return { ok: false, detail: 'dist/index.html に CSP が無い' };
  const bad = m[1].match(/\*|'unsafe-inline'|'unsafe-eval'/g);
  return { ok: !bad, detail: bad ? `危険な指定: ${[...new Set(bad)].join(', ')}` : m[1].slice(0, 60) + '…' };
});
check('no-secrets', 'B2 秘密情報・IDの直書きが無い', () => {
  const hits = [];
  for (const f of sourceFiles(['.ts', '.tsx', '.js', '.mjs', '.html', '.json'])) {
    if (/package-lock\.json$/.test(f)) continue;
    const s = readFileSync(f, 'utf8');
    // APIキー風の長い英数字、Google のスプレッドシートID風、メールアドレス
    if (/AIza[0-9A-Za-z_-]{30,}/.test(s)) hits.push(`${relative(root, f)}: APIキー風の文字列`);
    if (/["'][0-9A-Za-z_-]{40,44}["']\s*(;|,|\))/.test(s) && /(sheet|spreadsheet|scriptId)/i.test(s))
      hits.push(`${relative(root, f)}: シートID風の文字列`);
    if (/[\w.+-]+@(gmail|outlook|yahoo)\.[a-z.]+/i.test(s)) hits.push(`${relative(root, f)}: メールアドレス`);
  }
  return { ok: hits.length === 0, detail: hits.join(' / ') };
});
check('no-postmessage-star', "B4 postMessage の宛先が '*' でない", () => {
  const hits = sourceFiles(['.ts', '.tsx', '.js', '.html']).filter((f) =>
    /postMessage\s*\([^)]*['"]\*['"]/.test(stripComments(readFileSync(f, 'utf8'))),
  );
  return { ok: hits.length === 0, detail: hits.map((f) => relative(root, f)).join(', ') };
});
if (cfg.features.serverSide) {
  check('server-guards', 'B5 サーバー側5段ガード', () => false);
} else {
  skip('server-guards', 'B5 サーバー側5段ガード', 'サーバーを持たない静的アプリ');
}

// ==========================================================================
// C. 堅牢性
// ==========================================================================
check('no-localstorage-clear', 'C5 localStorage.clear() を使っていない', () => {
  const hits = sourceFiles(['.ts', '.tsx', '.js', '.mjs', '.html'])
    // 検査スクリプト自身は、禁止パターンを文字列として持っているので対象外
    .filter((f) => !f.endsWith('check-project.mjs'))
    .filter((f) => /localStorage\s*\.\s*clear\s*\(/.test(stripComments(readFileSync(f, 'utf8'))));
  return { ok: hits.length === 0, detail: hits.map((f) => relative(root, f)).join(', ') };
});
check('localstorage-prefix', 'C6 localStorage のキーがアプリ接頭辞つき', () => {
  const keys = [];
  for (const f of sourceFiles(['.ts', '.tsx', '.js'])) {
    for (const m of readFileSync(f, 'utf8').matchAll(/localStorage\.(?:get|set|remove)Item\(\s*([^,)]+)/g)) {
      keys.push(m[1].trim());
    }
  }
  // 変数経由の場合は、その定義に接頭辞があるかを見る
  const src = sourceFiles(['.ts', '.tsx']).map((f) => readFileSync(f, 'utf8')).join('\n');
  const literals = [...src.matchAll(/STORAGE_KEY\s*=\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
  const bad = literals.filter((k) => !k.startsWith('werewolf.'));
  return {
    ok: bad.length === 0,
    detail: bad.length ? `接頭辞なし: ${bad.join(', ')}` : `キー: ${literals.join(', ') || '（未使用）'}`,
  };
});

// ==========================================================================
// D. 表示
// ==========================================================================
const indexSrc = read('index.html');
check('viewport-fit', 'D1 viewport に viewport-fit=cover がある', () =>
  indexSrc.includes('viewport-fit=cover'),
);
check('viewport-scalable', 'D1b viewport が拡大を禁止していない', () => ({
  ok: !/user-scalable\s*=\s*no/.test(indexSrc),
  detail: '児童画面に限って認められている指定',
}));
check('dvh', 'D2 100vh を単独で使っていない（dvh のフォールバックとしてのみ可）', () => {
  const bad = [];
  for (const f of sourceFiles(['.css', '.tsx', '.html'])) {
    const s = stripComments(readFileSync(f, 'utf8'));
    const lines = s.split('\n');
    lines.forEach((line, i) => {
      if (!/100vh/.test(line)) return;
      // 直後の行に 100dvh があればフォールバックとして正しい
      const next = lines.slice(i + 1, i + 3).join('');
      if (!/100dvh/.test(next) && !/100dvh/.test(line)) {
        bad.push(`${relative(root, f)}:${i + 1}`);
      }
    });
  }
  return { ok: bad.length === 0, detail: bad.join(', ') };
});
check('safe-area', 'D3 safe-area-inset を上下左右すべてに適用している', () => {
  const css = sourceFiles(['.css']).map((f) => readFileSync(f, 'utf8')).join('\n');
  const missing = ['top', 'bottom', 'left', 'right'].filter(
    (side) => !css.includes(`safe-area-inset-${side}`),
  );
  return { ok: missing.length === 0, detail: missing.length ? `不足: ${missing.join(', ')}` : '' };
});
check('fluid-type', 'D4 clamp() による fluid type を使っている', () => {
  const css = sourceFiles(['.css']).map((f) => readFileSync(f, 'utf8')).join('\n');
  return /font-size:\s*clamp\(/.test(css);
});
if (cfg.features.canvas) {
  check('canvas-dpr', 'D5 Canvas に devicePixelRatio 補正がある', () => {
    const src = sourceFiles(['.ts', '.tsx', '.js']).map((f) => readFileSync(f, 'utf8')).join('\n');
    return /getContext\(['"]2d['"]\)/.test(src) ? /devicePixelRatio/.test(src) : true;
  });
} else {
  const src = sourceFiles(['.ts', '.tsx', '.js']).map((f) => readFileSync(f, 'utf8')).join('\n');
  check('canvas-dpr', 'D5 Canvas に devicePixelRatio 補正がある', () => ({
    ok: !/getContext\(['"]2d['"]\)/.test(src),
    detail: 'Canvas 未使用の設定だが getContext(2d) が見つかった',
  }));
}
check('touch-action', 'D9 touch-action を指定している', () => {
  const css = sourceFiles(['.css']).map((f) => readFileSync(f, 'utf8')).join('\n');
  return /touch-action:\s*manipulation/.test(css);
});
check('reduced-motion', 'D10 prefers-reduced-motion に対応している', () => {
  const css = sourceFiles(['.css']).map((f) => readFileSync(f, 'utf8')).join('\n');
  return /@media\s*\(prefers-reduced-motion:\s*reduce\)/.test(css);
});
if (cfg.features.presentationMode) {
  check('presentation', 'D11 提示モードがある', () => {
    const css = sourceFiles(['.css']).map((f) => readFileSync(f, 'utf8')).join('\n');
    const src = sourceFiles(['.tsx']).map((f) => readFileSync(f, 'utf8')).join('\n');
    return /\.presentation/.test(css) && /requestFullscreen/.test(src);
  });
} else {
  skip('presentation', 'D11 提示モード', '一斉授業で使わない');
}
if (cfg.features.print) {
  check('print', 'D12 印刷 CSS がある', () => {
    const css = sourceFiles(['.css']).map((f) => readFileSync(f, 'utf8')).join('\n');
    return /@media\s+print/.test(css) && /@page/.test(css);
  });
} else {
  skip('print', 'D12 印刷 CSS', '印刷しないアプリ');
}
check('color-scheme', 'D13 color-scheme を明示している', () => {
  const css = sourceFiles(['.css']).map((f) => readFileSync(f, 'utf8')).join('\n');
  return /color-scheme:\s*(light|dark)/.test(css) || /name="color-scheme"/.test(indexSrc);
});
check('forced-colors', 'D14 forced-colors（ハイコントラスト）に対応している', () => {
  const css = sourceFiles(['.css']).map((f) => readFileSync(f, 'utf8')).join('\n');
  return /@media\s*\(forced-colors:\s*active\)/.test(css);
});

// ==========================================================================
// E. PWA
// ==========================================================================
check('manifest-id', 'E1 manifest の id/scope/start_url がリポジトリ名の絶対パス', () => {
  if (!manifest) return { ok: false, detail: 'dist/manifest.webmanifest が無い（先に npm run build）' };
  const base = cfg.repoBase;
  const problems = [];
  if (manifest.id !== base) problems.push(`id=${manifest.id}`);
  if (manifest.scope !== base) problems.push(`scope=${manifest.scope}`);
  if (!String(manifest.start_url).startsWith(base)) problems.push(`start_url=${manifest.start_url}`);
  return { ok: problems.length === 0, detail: problems.join(' ') || `${base} に固定されている` };
});
check('icons', 'E2 アイコン4種（any 2 / maskable 2）と apple-touch-icon がある', () => {
  if (!manifest) return { ok: false, detail: 'manifest が無い' };
  const any = manifest.icons.filter((i) => i.purpose === 'any');
  const maskable = manifest.icons.filter((i) => i.purpose === 'maskable');
  const apple = existsSync(join(dist, 'apple-touch-icon.png'));
  const ok = any.length >= 2 && maskable.length >= 2 && apple;
  return { ok, detail: `any=${any.length} maskable=${maskable.length} apple-touch-icon=${apple}` };
});
check('install-prompt', 'E3 beforeinstallprompt を <head> の最上部で捕捉している', () => {
  if (!/beforeinstallprompt/.test(read('public/pwa-install-hook.js') || '')) {
    return { ok: false, detail: 'public/pwa-install-hook.js に捕捉コードが無い' };
  }
  // <head> の中で、他のどの script より前にあること
  const head = indexSrc.slice(indexSrc.indexOf('<head>'), indexSrc.indexOf('</head>'));
  const scripts = [...head.matchAll(/<script[^>]*>/g)];
  return {
    ok: scripts.length > 0 && /pwa-install-hook/.test(scripts[0][0]),
    detail: scripts.length ? `最初の script: ${scripts[0][0].slice(0, 50)}` : 'script が無い',
  };
});
check('install-button', 'E4 アプリ内にインストールボタンがある', () => {
  const src = sourceFiles(['.tsx', '.ts']).map((f) => readFileSync(f, 'utf8')).join('\n');
  return /__deferredInstallPrompt/.test(src) && /インストール/.test(src);
});
check('sw-cache-prefix', 'E5 Service Worker のキャッシュ名にアプリ接頭辞がある', () => {
  const vite = read('vite.config.ts');
  const m = vite.match(/cacheId:\s*['"]([^'"]+)['"]/);
  return { ok: !!m, detail: m ? `cacheId='${m[1]}'` : 'cacheId が未設定（他アプリと混ざる）' };
});
check('sw-no-localstorage', 'E6 Service Worker が localStorage に触れていない', () => {
  if (!existsSync(join(dist, 'sw.js'))) return { ok: false, detail: 'dist/sw.js が無い' };
  return !/localStorage/.test(read(`${cfg.distDir}/sw.js`));
});
check('update-toast', 'E7 更新通知（あたらしいバージョンがあります）がある', () => {
  const src = sourceFiles(['.tsx', '.ts']).map((f) => readFileSync(f, 'utf8')).join('\n');
  return /あたらしい\s*バージョン/.test(src) && /registerType:\s*'prompt'/.test(read('vite.config.ts'));
});
check('offline-html', 'E8 offline.html がある', () => existsSync(join(dist, 'offline.html')));
check('ios-guide', 'E10 iOS の「ホーム画面に追加」手順を MANUAL に書いている', () => {
  const m = read('MANUAL.md');
  return /ホーム画面に追加/.test(m) && /共有ボタン/.test(m);
});

// ==========================================================================
// F. アクセシビリティ・性能
// ==========================================================================
check('aria', 'F1 aria-label と aria-live を使っている', () => {
  const src = sourceFiles(['.tsx']).map((f) => readFileSync(f, 'utf8')).join('\n');
  const missing = ['aria-label', 'aria-live', 'aria-modal'].filter((a) => !src.includes(a));
  return { ok: missing.length === 0, detail: missing.length ? `不足: ${missing.join(', ')}` : '' };
});
check('ruby-rp', 'F1b ルビに <rp> を添えている（読み上げの二重読み対策）', () => {
  const src = sourceFiles(['.tsx']).map((f) => readFileSync(f, 'utf8')).join('\n');
  return !/<ruby>/.test(src) || /<rp>/.test(src);
});
check('focus-visible', 'F2 :focus-visible の可視スタイルがある', () => {
  const css = sourceFiles(['.css']).map((f) => readFileSync(f, 'utf8')).join('\n');
  return /:focus-visible\s*\{[^}]*outline/.test(css);
});
check('initial-js', `F3 初回 JS が ${kb(cfg.budgets.initialJs)} 以下`, () => {
  if (!distExists) return { ok: false, detail: 'dist が無い' };
  const entry = [...distHtml.matchAll(/<script[^>]+src="\.\/(assets\/[^"]+\.js)"/g)].map((m) => m[1]);
  const total = entry.reduce((a, f) => a + bytes(join(cfg.distDir, f)), 0);
  return { ok: total <= cfg.budgets.initialJs, detail: `${kb(total)} (${entry.length}本)` };
});
check('file-size', `F4 1ファイルが ${cfg.budgets.maxFileLines}行 / ${kb(cfg.budgets.maxFileBytes)} 以内`, () => {
  const bad = [];
  for (const f of sourceFiles(['.ts', '.tsx', '.js', '.mjs', '.css', '.html'])) {
    const s = readFileSync(f, 'utf8');
    const lines = s.split('\n').length;
    const size = Buffer.byteLength(s);
    if (lines > cfg.budgets.maxFileLines || size > cfg.budgets.maxFileBytes) {
      bad.push(`${relative(root, f)} (${lines}行 / ${kb(size)})`);
    }
  }
  return { ok: bad.length === 0, detail: bad.join(', ') };
});
check('total-assets', `F5 配信物の合計が ${kb(cfg.budgets.totalAssets)} 以下`, () => {
  if (!distExists) return { ok: false, detail: 'dist が無い' };
  let total = 0;
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else total += statSync(p).size;
    }
  };
  walk(dist);
  return { ok: total <= cfg.budgets.totalAssets, detail: kb(total) };
});
check('image-budget', 'F6 画像が容量の上限内', () => {
  if (!distExists) return { ok: false, detail: 'dist が無い' };
  const bad = [];
  for (const f of readdirSync(dist).filter((f) => f.endsWith('.png'))) {
    const size = bytes(join(cfg.distDir, f));
    const limit = f.startsWith('favicon')
      ? cfg.budgets.favicon
      : f.startsWith('pwa-') || f.startsWith('apple-')
        ? cfg.budgets.pwaIcon
        : cfg.budgets.image;
    if (size > limit) bad.push(`${f} ${kb(size)} > ${kb(limit)}`);
  }
  return { ok: bad.length === 0, detail: bad.join(', ') };
});
check('no-external-origin', 'F7 配信物が外部オリジンへ通信しない', () => {
  const hits = new Set();
  for (const f of ['index.html', 'src/index.css', 'src/fonts.css']) {
    for (const m of read(f).matchAll(/https?:\/\/([^/'")\s]+)/g)) {
      // note.com へのリンク（フッターのクレジット）は通信ではないので除く
      if (m[1] !== 'note.com') hits.add(m[1]);
    }
  }
  return { ok: hits.size === 0, detail: [...hits].join(', ') };
});

// ==========================================================================
// G. 学習ログ
// ==========================================================================
if (cfg.features.studyLog) {
  check('study-log', 'G1 study.v1 準拠', () => false);
} else {
  skip('study-log', 'G1 study.v1 準拠', '成績・正誤を記録しないアプリ');
}

// ==========================================================================
// 結果
// ==========================================================================
const failed = results.filter((r) => !r.ok && !r.exception);
const excused = results.filter((r) => !r.ok && r.exception);

console.log('\n🏗️  GIGA Standard v4 品質ゲート — 人狼ゲーム\n');
for (const r of results) {
  const mark = r.ok ? (r.skipped ? '—' : '✅') : r.exception ? '⚠️ ' : '❌';
  console.log(`${mark} ${r.label}${r.detail ? `\n     ${r.detail}` : ''}`);
  if (r.exception) console.log(`     許可済み: ${r.exception.reason}`);
}

const passed = results.filter((r) => r.ok && !r.skipped).length;
const skipped = results.filter((r) => r.skipped).length;
console.log(
  `\n合格 ${passed} / 該当なし ${skipped} / 例外として許可 ${excused.length} / 不合格 ${failed.length}`,
);

if (failed.length) {
  console.error('\n❌ 品質ゲートに通らなかった項目があります。');
  console.error('   閾値を下げるのではなく、直すか、quality.config.json の exceptions に');
  console.error('   理由を書いて明示的に許可してください。');
  process.exit(1);
}
console.log('\n✅ 品質ゲートを通過しました。');
