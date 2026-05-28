// Wrap pearl.svg (a 995x310 wordmark) inside a square ink-950 tile and
// rasterize at every size Chrome wants:
//   16 / 32 / 48 / 128 — toolbar action icon + extension manager
//   128 standalone     — Chrome Web Store item-icon upload
//
// The wordmark is recoloured pearl-200 (warm cream) and the tile background
// is pearl ink-950 (#111110), so the icon reads cleanly on both light and
// dark Chrome themes and matches the wallet's brand identity.
//
// Run: node scripts/rasterize-icons.mjs

import { readFileSync } from 'node:fs';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const SVG_PATH = path.join(ROOT, 'pearl.svg');

const BG  = '#111110';   // ink-950
const FG  = '#f0efea';   // pearl-200 (dark-mode cream)

const OUT_EXTENSION_DIR = path.join(ROOT, 'src', 'assets');
const OUT_STORE_FILE    = path.join(ROOT, 'pearl-wallet-icon-128.png');

// Sizes for the extension's `icons` + `action.default_icon` arrays.
const EXTENSION_SIZES = [16, 32, 48, 128];

const RAW = readFileSync(SVG_PATH, 'utf8');

// Strip the <svg> wrapper so we can re-embed the paths inside a fresh
// container with our own viewBox, then recolour fill="black" → cream.
function innerSvg() {
  const opened = RAW.replace(/^[\s\S]*?<svg[^>]*>/, '');
  const stripped = opened.replace(/<\/svg>[\s\S]*$/, '');
  return stripped.replace(/fill="black"/g, `fill="${FG}"`);
}
const PATHS = innerSvg();

// Source viewBox of the wordmark.
const SRC_W = 995;
const SRC_H = 310;

// Build a square SVG of the requested size with the wordmark centred and
// scaled to fit (leaving a ~14% margin). Includes a rounded-rect tile bg.
function squareSvg(size) {
  const margin = size * 0.14;          // ~14% breathing room
  const innerW = size - margin * 2;
  const innerH = innerW * (SRC_H / SRC_W);
  const scale  = innerW / SRC_W;
  const tx     = margin;
  const ty     = (size - innerH) / 2;
  const radius = size * 0.18;          // soft rounded tile

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="${BG}"/>
  <g transform="translate(${tx}, ${ty}) scale(${scale})">
    ${PATHS}
  </g>
</svg>`;
}

async function rasterise(size, outPath) {
  // Render at a higher density so the small-size text edges stay crisp,
  // THEN resize down to the exact pixel count Chrome expects.
  const svg = Buffer.from(squareSvg(size));
  const png = await sharp(svg, { density: 384 })
    .resize(size, size, { fit: 'contain' })
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(outPath, png);
  return png.length;
}

async function main() {
  await mkdir(OUT_EXTENSION_DIR, { recursive: true });
  console.log('Rasterising pearl.svg → square icons\n');

  for (const size of EXTENSION_SIZES) {
    const out = path.join(OUT_EXTENSION_DIR, `icon-${size}.png`);
    const bytes = await rasterise(size, out);
    console.log(`  icon-${size}.png   ${(bytes / 1024).toFixed(1)} KB  →  src/assets/`);
  }

  const storeBytes = await rasterise(128, OUT_STORE_FILE);
  console.log(`\n  pearl-wallet-icon-128.png   ${(storeBytes / 1024).toFixed(1)} KB  →  repo root  (Chrome Web Store)`);
}

main().catch(err => { console.error(err); process.exit(1); });
