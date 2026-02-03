#!/usr/bin/env node
/**
 * Trim image to content (oval) and add a small white margin.
 * Output: public/logo-oval-trimmed.png (used as source for favicon).
 *
 * To generate favicon that fits inside the tab square, run after this:
 *   node scripts/favicon-from-oval.mjs
 *
 * Usage: node scripts/trim-oval-with-margin.mjs [input.png] [output.png] [marginPx]
 */

import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const inputPath =
  process.argv[2] ||
  path.join(
    projectRoot,
    '../.cursor/projects/Users-kylemillard-daysweeper/assets/IMG_1264-8639e26b-79f4-4d14-9261-2cfd8c183bcb.png'
  );
const outputPath =
  process.argv[3] || path.join(projectRoot, 'public', 'logo-oval-trimmed.png');
const marginPx = Number(process.argv[4]) || 24;

async function main() {
  const image = sharp(inputPath);
  const meta = await image.metadata();
  const { width, height } = meta;

  // Trim to content (removes transparent/same-color edges); fallback to full size if no trim
  let trimmed = await image.trim({ threshold: 20 }).toBuffer();
  let trimmedMeta = await sharp(trimmed).metadata();
  let tw = trimmedMeta.width;
  let th = trimmedMeta.height;

  // If trim didn't remove anything, extend canvas with white instead (add margin around full image)
  if (tw >= width && th >= height) {
    const canvasWidth = width + marginPx * 2;
    const canvasHeight = height + marginPx * 2;
    const whiteBg = await sharp({
      create: {
        width: canvasWidth,
        height: canvasHeight,
        channels: meta.channels || 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      }
    })
      .png()
      .toBuffer();
    await sharp(whiteBg)
      .composite([{ input: await sharp(inputPath).toBuffer(), left: marginPx, top: marginPx }])
      .png()
      .toFile(outputPath);
    console.log(
      `Added ${marginPx}px white margin around ${width}x${height} → ${canvasWidth}x${canvasHeight}`
    );
  } else {
    const canvasWidth = tw + marginPx * 2;
    const canvasHeight = th + marginPx * 2;
    const whiteBackground = await sharp({
      create: {
        width: canvasWidth,
        height: canvasHeight,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      }
    })
      .png()
      .toBuffer();
    await sharp(whiteBackground)
      .composite([{ input: trimmed, left: marginPx, top: marginPx }])
      .png()
      .toFile(outputPath);
    console.log(
      `Trimmed ${width}x${height} → ${tw}x${th}, added ${marginPx}px white margin → ${canvasWidth}x${canvasHeight}`
    );
  }
  console.log(`Saved: ${outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
