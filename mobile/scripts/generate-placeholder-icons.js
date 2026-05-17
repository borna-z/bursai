// Generates the three Expo app-icon variants as 1024×1024 PNGs with a
// solid #946C20 gold background and a centred white "B".
//
// The pre-launch audit (2026-05-17) found that `mobile/assets/icon.png`,
// `splash-icon.png`, and `adaptive-icon.png` were 87% near-white (RGB
// 245,245,247) — the default Expo placeholder shipped from `npx
// create-expo-app`. Submitting that to App Store / Play Store would
// fail review, and a near-white square reads as "broken install" to
// any user who sees it on their home screen. This script writes a
// legible (if still placeholder) brand mark until the real artwork
// from the designer lands.
//
// Run with: `node scripts/generate-placeholder-icons.js` from mobile/.

const path = require('node:path');
const sharp = require('sharp');

const SIZE = 1024;
const BG = '#946C20';
const FG = '#FFFFFF';
// 60% of canvas — large enough that the letterform reads on a phone
// home screen, small enough to leave breathing room from the edge.
const FONT_PX = Math.round(SIZE * 0.6);

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <rect width="${SIZE}" height="${SIZE}" fill="${BG}"/>
  <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central"
        font-family="Georgia, 'Times New Roman', serif" font-weight="700"
        font-size="${FONT_PX}" fill="${FG}">B</text>
</svg>`;

const TARGETS = ['icon.png', 'splash-icon.png', 'adaptive-icon.png'];

async function main() {
  const assetsDir = path.join(__dirname, '..', 'assets');
  for (const file of TARGETS) {
    const out = path.join(assetsDir, file);
    await sharp(Buffer.from(svg))
      .resize(SIZE, SIZE)
      .png()
      .toFile(out);
    console.log(`wrote ${out}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
