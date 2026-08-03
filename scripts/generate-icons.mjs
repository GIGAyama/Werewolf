// ==========================================================================
// アイコン一式を assets/icon-master.png から生成する。
// 使い方: npm run icons
//
// 元画像を assets/ に置いて、配信する public/ とは分けている理由:
//   以前は public/favicon.png（512×512・93KB）が「配信物」と「生成元」を
//   兼ねていた。favicon を軽くしようとすると生成元まで劣化してしまい、
//   一度圧縮したら元に戻せなくなる。元画像は無圧縮のまま assets/ に置き、
//   public/ には毎回そこから作り直した軽い画像だけを置く。
//   assets/ は Vite の対象外なので、dist/ には入らない。
//
// 圧縮について:
//   palette:true で 256色のインデックスカラーに落としている。このアイコンは
//   平坦な色面と縁取りでできているので、写真と違って劣化がほとんど見えない。
//   校内 Wi-Fi で 40台が一斉に読み込む前提なので、ここは効く。
// ==========================================================================
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { statSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const src = join(root, 'assets', 'icon-master.png');
const outDir = join(root, 'public');

// アプリの背景色。透過を潰す必要がある場面で使う。
const BG = '#050510';

// PNG の書き出し設定。数値の意味は上のコメントを参照。
const PNG = { palette: true, quality: 90, effort: 10, compressionLevel: 9 };

// 容量の上限（GIGA Standard v4 §2-6）。超えたらビルドを止める。
const LIMITS = {
  'favicon.png': 30 * 1024,
  'pwa-192x192.png': 60 * 1024,
  'pwa-512x512.png': 60 * 1024,
  'pwa-maskable-192x192.png': 60 * 1024,
  'pwa-maskable-512x512.png': 60 * 1024,
  'apple-touch-icon.png': 60 * 1024,
};

async function write(name, pipeline) {
  await pipeline.png(PNG).toFile(join(outDir, name));
  const size = statSync(join(outDir, name)).size;
  const limit = LIMITS[name];
  const ok = !limit || size <= limit;
  console.log(
    `  ${ok ? '✅' : '❌'} ${name.padEnd(28)} ${(size / 1024).toFixed(1).padStart(6)} KB` +
      (limit ? `  (上限 ${(limit / 1024).toFixed(0)}KB)` : ''),
  );
  return ok;
}

/** マスカブル: ランチャーが丸や角丸に切り抜くので、中央80%（セーフゾーン）に収める */
async function maskable(size) {
  const inner = Math.round(size * 0.8);
  const resized = await sharp(src).resize(inner, inner).png().toBuffer();
  return sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  }).composite([{ input: resized, gravity: 'center' }]);
}

async function main() {
  console.log(`元画像: assets/icon-master.png (${(statSync(src).size / 1024).toFixed(1)} KB)`);

  const results = [
    // favicon はタブに 16〜32px で出るだけなので、512 も持つ必要がない
    await write('favicon.png', sharp(src).resize(128, 128)),
    await write('pwa-192x192.png', sharp(src).resize(192, 192)),
    await write('pwa-512x512.png', sharp(src).resize(512, 512)),
    await write('pwa-maskable-192x192.png', await maskable(192)),
    await write('pwa-maskable-512x512.png', await maskable(512)),
    // iOS は maskable に対応しないので、余白と背景をあらかじめ焼き込む
    await write(
      'apple-touch-icon.png',
      sharp(src).resize(180, 180, { fit: 'contain', background: BG }).flatten({ background: BG }),
    ),
  ];

  if (results.includes(false)) {
    console.error('❌ 容量の上限を超えたアイコンがある。元画像を見直すこと。');
    process.exit(1);
  }
  console.log('✅ PWA アイコンを生成した (public/)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
