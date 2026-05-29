// Letterbox the raw popup screenshots into 1280x800 canvases for the
// Chrome Web Store listing.
//
// Constraints we honour:
//   - 1280x800 px (the larger of the two allowed sizes — better store render)
//   - PNG, RGB only (no alpha) — Chrome rejects RGBA store screenshots
//   - Warm ink-950 backdrop so the popup blends with its own brand colour
//   - Popup pre-scaled to ~720 px tall so it dominates the canvas
//
// Source: every "Screenshot 2026-*.png" sitting in the repo root.
// Output: store-screenshots/screenshot-N.png  (numbered by source order)

import { readdir, mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT_DIR = path.join(ROOT, 'store-screenshots');

const W = 1280;
const H = 800;
const BG = { r: 0x11, g: 0x11, b: 0x10 };   // ink-950 #111110
const POPUP_TARGET_HEIGHT = 720;             // 90 % of canvas height

async function letterbox(srcPath, outPath) {
  // Pre-scale the popup screenshot so its height fills most of the canvas.
  const meta = await sharp(srcPath).metadata();
  const scaledW = Math.round((meta.width / meta.height) * POPUP_TARGET_HEIGHT);

  const popup = await sharp(srcPath)
    .resize(scaledW, POPUP_TARGET_HEIGHT, { kernel: 'lanczos3' })
    .png()
    .toBuffer();

  // Solid 3-channel canvas. flatten() makes sure the final image has no
  // alpha channel — the store rejects RGBA screenshots.
  await sharp({
    create: { width: W, height: H, channels: 3, background: BG },
  })
    .composite([{ input: popup, gravity: 'center' }])
    .flatten({ background: BG })
    .removeAlpha()       // force RGB-only output — Chrome Web Store rejects RGBA
    .png({ compressionLevel: 9 })
    .toFile(outPath);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const sources = (await readdir(ROOT))
    .filter(f => /^Screenshot 2026-.*\.png$/i.test(f))
    .sort();    // chronological by filename timestamp

  if (sources.length === 0) {
    console.error('No "Screenshot 2026-*.png" files found in', ROOT);
    process.exit(1);
  }

  console.log(`Found ${sources.length} screenshot(s):\n`);
  for (const [i, name] of sources.entries()) {
    const src = path.join(ROOT, name);
    const out = path.join(OUT_DIR, `screenshot-${i + 1}.png`);
    await letterbox(src, out);
    const dims = await sharp(out).metadata();
    console.log(`  ${name}\n  →  store-screenshots/screenshot-${i + 1}.png   ${dims.width}x${dims.height}  ${dims.channels} ch\n`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
