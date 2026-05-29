// Turn the raw popup screenshots in store-screenshots/ into:
//   1) Chrome Web Store upload images — 1280×800, 24-bit RGB, no alpha,
//      letterboxed on the brand ink-950 backdrop → store-screenshots/upload/
//   2) A 1080p slideshow video (crossfades) for YouTube → store-screenshots/
//
// Run: node scripts/store-media.mjs
// (ffmpeg-static is installed --no-save; sharp is a devDependency.)

import { readdir, mkdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import sharp from 'sharp';
import ffmpegPath from 'ffmpeg-static';

const run = promisify(execFile);
const ROOT = path.resolve(import.meta.dirname, '..');
const DIR  = path.join(ROOT, 'store-screenshots');
const UPLOAD = path.join(DIR, 'upload');
const FRAMES = path.join(DIR, '.frames');

const BG = { r: 0x11, g: 0x11, b: 0x10 };   // ink-950 #111110

// Deliberate narrative order (filenames the user dropped in, sans .png).
const ORDER = ['login', 'send', 'sendreview', 'senttx', 'settings'];

// Resolve which of ORDER actually exist; fall back to whatever PNGs are there.
async function sources() {
  const present = (await readdir(DIR)).filter(f => /\.png$/i.test(f) && !f.startsWith('.'));
  const byStem = new Map(present.map(f => [f.replace(/\.png$/i, '').toLowerCase(), f]));
  const ordered = ORDER.filter(s => byStem.has(s)).map(s => byStem.get(s));
  // Append any extra screenshots not in ORDER, alphabetically.
  const extra = present.filter(f => !ordered.includes(f)).sort();
  return [...ordered, ...extra].map(f => path.join(DIR, f));
}

// ── 1) Store images: 1280×800 RGB, popup centred, no alpha ─────────────────
async function buildStoreImages(srcs) {
  await rm(UPLOAD, { recursive: true, force: true });
  await mkdir(UPLOAD, { recursive: true });
  const W = 1280, H = 800, TARGET_H = 720;

  for (const [i, src] of srcs.entries()) {
    const meta = await sharp(src).metadata();
    const scaledW = Math.round((meta.width / meta.height) * TARGET_H);
    const popup = await sharp(src).resize(scaledW, TARGET_H, { kernel: 'lanczos3' }).png().toBuffer();
    const stem = path.basename(src, '.png');
    const out = path.join(UPLOAD, `${String(i + 1).padStart(2, '0')}-${stem}.png`);
    await sharp({ create: { width: W, height: H, channels: 3, background: BG } })
      .composite([{ input: popup, gravity: 'center' }])
      .flatten({ background: BG })
      .removeAlpha()
      .png({ compressionLevel: 9 })
      .toFile(out);
    console.log(`  store  ${path.basename(out)}  1280x800`);
  }
}

// ── 2) Video frames: 1920×1080, popup centred on a soft radial backdrop ────
function backdropSvg(w, h) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs>
      <radialGradient id="g" cx="50%" cy="0%" r="90%">
        <stop offset="0%" stop-color="#1c1b19"/>
        <stop offset="55%" stop-color="#141312"/>
        <stop offset="100%" stop-color="#0d0d0c"/>
      </radialGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#g)"/>
  </svg>`);
}

async function buildFrames(srcs) {
  await rm(FRAMES, { recursive: true, force: true });
  await mkdir(FRAMES, { recursive: true });
  const W = 1920, H = 1080, TARGET_H = 880;
  const bg = await sharp(backdropSvg(W, H)).png().toBuffer();
  const frames = [];

  for (const [i, src] of srcs.entries()) {
    const meta = await sharp(src).metadata();
    const scaledW = Math.round((meta.width / meta.height) * TARGET_H);
    const popup = await sharp(src)
      .resize(scaledW, TARGET_H, { kernel: 'lanczos3' })
      .extend({ top: 0, bottom: 0, left: 0, right: 0 })   // keep as-is
      .png().toBuffer();
    const out = path.join(FRAMES, `f${i}.png`);
    await sharp(bg)
      .composite([{ input: popup, gravity: 'center' }])
      .flatten({ background: BG })
      .removeAlpha()
      .png()
      .toFile(out);
    frames.push(out);
  }
  return frames;
}

async function buildVideo(frames) {
  const D = 3.0;   // seconds each screen is fully shown (incl. transition)
  const T = 0.6;   // crossfade duration
  const n = frames.length;

  const inputs = [];
  for (const f of frames) inputs.push('-loop', '1', '-t', String(D), '-i', f);

  // Chain xfades: [0][1]→[v1], [v1][2]→[v2], … last → [vx]
  const parts = [];
  let prev = '[0]';
  for (let i = 1; i < n; i++) {
    const offset = (i * (D - T)).toFixed(3);
    const out = i === n - 1 ? '[vx]' : `[v${i}]`;
    parts.push(`${prev}[${i}]xfade=transition=fade:duration=${T}:offset=${offset}${out}`);
    prev = out;
  }
  const total = n * D - (n - 1) * T;
  const filter = parts.join(';') +
    `;[vx]fps=30,format=yuv420p,fade=t=in:st=0:d=0.4,fade=t=out:st=${(total - 0.5).toFixed(3)}:d=0.5[v]`;

  const out = path.join(DIR, 'pearl-wallet-demo.mp4');
  const args = [
    '-y', ...inputs,
    '-filter_complex', filter,
    '-map', '[v]',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    out,
  ];
  await run(ffmpegPath, args, { maxBuffer: 1 << 26 });
  console.log(`\n  video  pearl-wallet-demo.mp4  1920x1080  ~${total.toFixed(1)}s`);
  return out;
}

async function main() {
  if (!existsSync(DIR)) { console.error('store-screenshots/ not found'); process.exit(1); }
  const srcs = await sources();
  if (srcs.length === 0) { console.error('No source PNGs in store-screenshots/'); process.exit(1); }
  console.log(`Sources (${srcs.length}): ${srcs.map(s => path.basename(s)).join(', ')}\n`);

  await buildStoreImages(srcs);
  const frames = await buildFrames(srcs);
  await buildVideo(frames);
  await rm(FRAMES, { recursive: true, force: true });   // tidy temp frames

  console.log('\nDone.');
  console.log('  • Store images → store-screenshots/upload/  (1280×800, RGB, no alpha)');
  console.log('  • YouTube video → store-screenshots/pearl-wallet-demo.mp4');
}

main().catch(e => { console.error(e); process.exit(1); });
