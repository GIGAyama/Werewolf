// favicon.png から PWA 用の各種アイコンを生成するスクリプト。
// 使い方: npm run icons
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const src = join(root, 'public', 'favicon.png');
const outDir = join(root, 'public');

async function main() {
  // 通常アイコン（そのまま）
  await sharp(src).resize(192, 192).png().toFile(join(outDir, 'pwa-192x192.png'));
  await sharp(src).resize(512, 512).png().toFile(join(outDir, 'pwa-512x512.png'));

  // Apple 用（背景を付けて余白を確保）
  await sharp(src)
    .resize(180, 180, { fit: 'contain', background: '#050510' })
    .flatten({ background: '#050510' })
    .png()
    .toFile(join(outDir, 'apple-touch-icon.png'));

  // マスカブルアイコン: セーフゾーン確保のため約80%に縮小し、背景で埋める
  const inner = Math.round(512 * 0.8);
  const resized = await sharp(src).resize(inner, inner).png().toBuffer();
  await sharp({
    create: { width: 512, height: 512, channels: 4, background: '#050510' },
  })
    .composite([{ input: resized, gravity: 'center' }])
    .png()
    .toFile(join(outDir, 'pwa-maskable-512x512.png'));

  console.log('✅ PWA アイコンを生成しました (public/)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
