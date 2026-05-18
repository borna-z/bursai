#!/usr/bin/env node
/* eslint-disable */
/**
 * Generates the BURS app icon family from the canonical brand mark.
 *
 * Source: ../../src/assets/burs-logo.png (792x608, mark drawn in dark
 * charcoal on a near-white background — the mark occupies a 693x468 bbox).
 * The mark is extracted by luminance threshold into a binary alpha mask,
 * then recolored and composited onto each target background.
 *
 * Outputs (under mobile/assets/):
 *   icon.png           1024x1024  cream    #FBF7EF  black mark
 *   icon-dark.png      1024x1024  charcoal #0F172A  white mark
 *   icon-tinted.png    1024x1024  transparent       white mark (iOS18 tint)
 *   adaptive-icon.png  1024x1024  transparent       black mark (Android)
 *   splash-icon.png    1024x1024  transparent       black mark (40% canvas)
 *   favicon.png        196x196    cream    #FBF7EF  black mark
 *
 * Run: node scripts/generate-app-icons.js   (from mobile/)
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SOURCE = path.resolve(__dirname, '../../src/assets/burs-logo.png');
const OUT_DIR = path.resolve(__dirname, '../assets');

const CREAM = { r: 0xFB, g: 0xF7, b: 0xEF };
const CHARCOAL = { r: 0x0F, g: 0x17, b: 0x2A };
const BLACK = { r: 0, g: 0, b: 0 };
const WHITE = { r: 255, g: 255, b: 255 };

const LUM_THRESHOLD = 128; // pixels darker than this are "mark"

/**
 * Extract the mark from the source as an RGBA buffer with binary alpha.
 * Returns { buffer, width, height } where width/height are the cropped bbox.
 */
async function extractMark() {
  const { data, info } = await sharp(SOURCE)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const ch = info.channels;

  let minX = w, minY = h, maxX = -1, maxY = -1;
  const alphaMask = Buffer.alloc(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * ch;
      const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
      if (lum < LUM_THRESHOLD) {
        // Smooth-edge alpha: 0 at threshold, 255 at black
        const a = Math.min(255, Math.round((LUM_THRESHOLD - lum) * 2));
        alphaMask[y * w + x] = a;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;
  const cropped = Buffer.alloc(cropW * cropH * 4);
  for (let y = 0; y < cropH; y++) {
    for (let x = 0; x < cropW; x++) {
      const srcIdx = (minY + y) * w + (minX + x);
      const dstIdx = (y * cropW + x) * 4;
      cropped[dstIdx] = 0;
      cropped[dstIdx + 1] = 0;
      cropped[dstIdx + 2] = 0;
      cropped[dstIdx + 3] = alphaMask[srcIdx];
    }
  }
  return { buffer: cropped, width: cropW, height: cropH };
}

/** Recolor an RGBA mark buffer to a solid color (preserving alpha). */
function recolor(markBuf, color) {
  const out = Buffer.alloc(markBuf.length);
  for (let i = 0; i < markBuf.length; i += 4) {
    out[i] = color.r;
    out[i + 1] = color.g;
    out[i + 2] = color.b;
    out[i + 3] = markBuf[i + 3];
  }
  return out;
}

/**
 * Compose a square icon: optional solid background + centered mark scaled
 * to fill `scale` fraction of the canvas (by width). `opticalYShift` nudges
 * the mark upward (positive = up) as a fraction of canvas height — the
 * B-hanger silhouette is bottom-heavy so a small upward shift makes it read
 * as visually centered.
 */
async function composeIcon({ outPath, canvas, bg, markColor, mark, scale, opticalYShift = 0 }) {
  const targetMarkW = Math.round(canvas * scale);
  const aspect = mark.height / mark.width;
  const targetMarkH = Math.round(targetMarkW * aspect);

  const recolored = recolor(mark.buffer, markColor);
  const resizedMark = await sharp(recolored, {
    raw: { width: mark.width, height: mark.height, channels: 4 },
  })
    .resize(targetMarkW, targetMarkH, { kernel: 'lanczos3' })
    .png()
    .toBuffer();

  const base = sharp({
    create: {
      width: canvas,
      height: canvas,
      channels: 4,
      background: bg
        ? { r: bg.r, g: bg.g, b: bg.b, alpha: 1 }
        : { r: 0, g: 0, b: 0, alpha: 0 },
    },
  });

  const left = Math.round((canvas - targetMarkW) / 2);
  const top = Math.round((canvas - targetMarkH) / 2 - canvas * opticalYShift);

  await base
    .composite([{ input: resizedMark, left, top }])
    .png({ compressionLevel: 9 })
    .toFile(outPath);

  const stat = fs.statSync(outPath);
  console.log(`  ${path.basename(outPath)}  ${canvas}x${canvas}  ${(stat.size / 1024).toFixed(1)} KB`);
}

(async () => {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`source: ${path.relative(process.cwd(), SOURCE)}`);
  const mark = await extractMark();
  console.log(`mark bbox: ${mark.width}x${mark.height}`);

  // iOS / web icons: mark fills 72% of canvas width — sits within Apple's icon safe area (~76%) with breathing room.
  // Optical shift up 3% compensates for the bottom-heavy hanger triangle.
  const IOS_SCALE = 0.72;
  const IOS_Y_SHIFT = 0.03;
  await composeIcon({
    outPath: path.join(OUT_DIR, 'icon.png'),
    canvas: 1024, bg: CREAM, markColor: BLACK, mark, scale: IOS_SCALE, opticalYShift: IOS_Y_SHIFT,
  });
  await composeIcon({
    outPath: path.join(OUT_DIR, 'icon-dark.png'),
    canvas: 1024, bg: CHARCOAL, markColor: WHITE, mark, scale: IOS_SCALE, opticalYShift: IOS_Y_SHIFT,
  });
  await composeIcon({
    outPath: path.join(OUT_DIR, 'icon-tinted.png'),
    canvas: 1024, bg: null, markColor: WHITE, mark, scale: IOS_SCALE, opticalYShift: IOS_Y_SHIFT,
  });

  // Android adaptive foreground: mark constrained to 660x660 safe zone (~64% of 1024)
  // — outer ring is masked by the launcher, so scale of 0.40 keeps the mark inside the visible circle/squircle
  await composeIcon({
    outPath: path.join(OUT_DIR, 'adaptive-icon.png'),
    canvas: 1024, bg: null, markColor: BLACK, mark, scale: 0.40,
  });

  // Splash: smaller mark on transparent — Expo paints bg via splash.backgroundColor
  await composeIcon({
    outPath: path.join(OUT_DIR, 'splash-icon.png'),
    canvas: 1024, bg: null, markColor: BLACK, mark, scale: 0.40,
  });

  // Web favicon
  await composeIcon({
    outPath: path.join(OUT_DIR, 'favicon.png'),
    canvas: 196, bg: CREAM, markColor: BLACK, mark, scale: 0.78, opticalYShift: IOS_Y_SHIFT,
  });

  console.log('done.');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
