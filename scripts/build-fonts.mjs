// ==========================================================================
// Web フォント (M PLUS Rounded 1c) を自己ホスト用にサブセット化して取得する。
// 使い方: npm run fonts
//
// なぜこれが要るか:
//   以前は src/index.css の先頭で Google Fonts を @import していた。これだと
//   (1) 初回にネットへ出るまで本文フォントが当たらない（校内 Wi-Fi で 40台
//       同時だと目に見えて遅れる。オフライン初回では当たらないまま）
//   (2) CSS 内の @import なので描画開始そのものが遅れる
//   (3) 外部オリジンへ通信するため、厳しい CSP を張れない
//   という3つの問題があった。
//
// なぜ「全部入り」ではなくサブセットか:
//   日本語フォントは全字入れると 1 ウェイトで数 MB あり、初回 1MB という
//   配信量の目標をひとりで使い切ってしまう。そこで
//     ・アプリが画面に出す文字（ソースから自動抽出）
//     ・ひらがな・カタカナ全部（プレイヤー名の入力を受け止めるため）
//     ・英数字・記号（半角と全角の両方。児童は全角で数字を打つことがある）
//     ・小学1〜2年の配当漢字
//   だけを入れる。
//
// 豆腐（□）にならないのはなぜか:
//   Google Fonts が返す @font-face には unicode-range が付いてくる。範囲外の
//   文字はブラウザがこのフォントを使おうとせず、そのまま次の候補（端末内蔵の
//   日本語フォント）へ落ちる。つまり児童が珍しい漢字の名前を入れても、書体が
//   変わるだけで文字は必ず出る。
// ==========================================================================
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const fontDir = join(root, 'public', 'fonts');

const FAMILY = 'M PLUS Rounded 1c';
const WEIGHTS = [700, 900];

// --- 収録する文字を組み立てる -------------------------------------------

const range = (from, to) =>
  Array.from({ length: to - from + 1 }, (_, i) => String.fromCodePoint(from + i)).join('');

// 半角の英数字・記号
const ASCII = range(0x20, 0x7e);
// ひらがな / カタカナ（濁点・小書き・長音符まで全部）
const KANA = range(0x3041, 0x309f) + range(0x30a0, 0x30ff);
// 全角の英数字・記号（児童は全角で名前や数字を打つことがある）
const FULLWIDTH = range(0xff01, 0xff5e);
// よく使う和文の記号
const PUNCT = '、。〈〉《》「」『』【】〔〕・…‥※〜ー―‐′″℃￥＄％＆＃＠♪→←↑↓○●◎△▲□■☆★♡✓✕';

// 小学1年の配当漢字 (80字)
const KANJI_G1 =
  '一右雨円王音下火花貝学気九休玉金空月犬見五口校左三山子四糸字耳七車手十出女小上森人水正生青夕石赤千川先早草足村大男竹中虫町天田土二日入年白八百文木本名目立力林六';
// 小学2年の配当漢字 (160字)
const KANJI_G2 =
  '引羽雲園遠何科夏家歌画回会海絵外角楽活間丸岩顔汽記帰弓牛魚京強教近兄形計元言原戸古午後語工公広交光考行高黄合谷国黒今才細作算止市矢姉思紙寺自時室社弱首秋週春書少場色食心新親図数西声星晴切雪船線前組走多太体台地池知茶昼長鳥朝直通弟店点電刀冬当東答頭同道読内南肉馬売買麦半番父風分聞米歩母方北毎妹万明鳴毛門夜野友用曜来里理話';

// アプリのソースに実際に出てくる文字を拾う（ふりがな・読み上げ文・役職名など）
function collectFromSources() {
  const files = [join(root, 'index.html')];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (/\.(tsx?|html|css)$/.test(entry.name)) files.push(p);
    }
  };
  walk(join(root, 'src'));
  walk(join(root, 'public'));
  return files.map((f) => readFileSync(f, 'utf8')).join('');
}

const chars = [
  ...new Set(
    (ASCII + KANA + FULLWIDTH + PUNCT + KANJI_G1 + KANJI_G2 + collectFromSources())
      // 収録するのは「見える文字」だけ。制御文字と、ソースに紛れ込む
      // ラテン以外の記号類（絵文字など）はフォントに入れない。
      .split('')
      .filter((c) => {
        const cp = c.codePointAt(0);
        if (cp < 0x20) return false;
        if (cp > 0xffff) return false; // サロゲートペア（絵文字）は対象外
        return true;
      }),
  ),
]
  .sort()
  .join('');

// --- 取得 ----------------------------------------------------------------

// Google Fonts の CSS API は User-Agent で返す形式を変える。
// woff2 を受け取るために、新しめの Chrome を名乗る。
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function fetchWeight(weight) {
  const url = new URL('https://fonts.googleapis.com/css2');
  url.searchParams.set('family', `${FAMILY}:wght@${weight}`);
  url.searchParams.set('text', chars);
  url.searchParams.set('display', 'swap');

  const cssRes = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!cssRes.ok) throw new Error(`CSS の取得に失敗 (${weight}): ${cssRes.status}`);
  const css = await cssRes.text();

  const srcMatch = css.match(/src:\s*url\(([^)]+)\)/);
  const rangeMatch = css.match(/unicode-range:\s*([^;]+);/);
  if (!srcMatch) throw new Error(`woff2 の URL が見つからない (${weight})`);

  const fontRes = await fetch(srcMatch[1], { headers: { 'User-Agent': UA } });
  if (!fontRes.ok) throw new Error(`woff2 の取得に失敗 (${weight}): ${fontRes.status}`);
  const buf = Buffer.from(await fontRes.arrayBuffer());

  const file = `mplus-rounded-1c-${weight}.woff2`;
  writeFileSync(join(fontDir, file), buf);
  console.log(`  ${file}  ${(buf.length / 1024).toFixed(1)} KB`);

  return { weight, file, unicodeRange: rangeMatch ? rangeMatch[1].trim() : null };
}

async function main() {
  mkdirSync(fontDir, { recursive: true });
  console.log(`収録する文字数: ${chars.length}`);

  const faces = [];
  for (const w of WEIGHTS) faces.push(await fetchWeight(w));

  const css = `/* ==========================================================================
 * このファイルは scripts/build-fonts.mjs が生成する。直接編集しないこと。
 * 生成し直すには: npm run fonts
 *
 * unicode-range は Google Fonts が返した値をそのまま使っている。ここに無い文字
 * （児童が入力した珍しい漢字など）は、このフォントを飛ばして下の端末内蔵
 * フォントへ落ちる。書体が変わるだけで、□（豆腐）にはならない。
 * ========================================================================== */
${faces
  .map(
    (f) => `@font-face {
  font-family: 'M PLUS Rounded 1c';
  font-style: normal;
  font-weight: ${f.weight};
  font-display: swap;
  src: url('/fonts/${f.file}') format('woff2');${
    f.unicodeRange ? `\n  unicode-range: ${f.unicodeRange};` : ''
  }
}`,
  )
  .join('\n\n')}
`;
  writeFileSync(join(root, 'src', 'fonts.css'), css);
  console.log('✅ public/fonts/ と src/fonts.css を更新した');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
