#!/usr/bin/env node
/**
 * Generate favicon assets from the APR oval logo so it fits inside the square.
 * Scales the oval to fit within the icon size with padding (no crop).
 *
 * Source: public/logo-oval-trimmed.png (or apr-favicon-package assets)
 * Outputs: src/app/icon.png, src/app/apple-icon.png, public/icon.png
 *
 * Usage: node scripts/favicon-from-oval.mjs [source.png]
 */

import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const sourcePath =
  process.argv[2] ||
  path.join(projectRoot, 'public', 'logo-oval-trimmed.png');

const PADDING_RATIO = 0.88; // use 88% of square so oval has clear margin inside

async function fitOvalInsideSquare(inputPath, size, outputPath) {
  const img = sharp(inputPath);
  const meta = await img.metadata();
  const w = meta.width;
  const h = meta.height;
  const maxSide = Math.max(w, h);
  const scale = (size * PADDING_RATIO) / maxSide;
  const newW = Math.round(w * scale);
  const newH = Math.round(h * scale);
  const left = Math.round((size - newW) / 2);
  const top = Math.round((size - newH) / 2);
  const resized = await img.resize(newW, newH).toBuffer();
  const bg = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    }
  })
    .png()
    .toBuffer();
  await sharp(bg)
    .composite([{ input: resized, left, top }])
    .png()
    .toFile(outputPath);
  console.log(
    `${size}x${size}: oval ${w}x${h} → ${newW}x${newH} centered (fits inside)`
  );
}

async function main() {
  const outApp = path.join(projectRoot, 'src', 'app');
  const outPublic = path.join(projectRoot, 'public');

  await fitOvalInsideSquare(sourcePath, 32, path.join(outApp, 'icon.png'));
  await fitOvalInsideSquare(sourcePath, 180, path.join(outApp, 'apple-icon.png'));
  await fitOvalInsideSquare(sourcePath, 32, path.join(outPublic, 'icon.png'));

  console.log('Favicon assets updated (APR oval fits inside square).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
