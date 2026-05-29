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
  const D = 3.2;   // seconds each screen is shown
  const T = 0.7;   // transition duration
  const FPS = 30;
  const n = frames.length;
  const total = n * D - (n - 1) * T;

  // Varied transitions for visual interest (cycled across the cuts).
  const TRANSITIONS = ['fade', 'slideleft', 'circleopen', 'wiperight', 'smoothup', 'slideup'];

  // ── Inputs: the still frames, then 4 sine tones for a generated music bed ──
  const inputs = [];
  for (const f of frames) inputs.push('-loop', '1', '-t', String(D), '-i', f);
  // Cmaj7 pad — C3 / E3 / G3 / B3. Pleasant, neutral, royalty-free (synthesised).
  const CHORD = [130.81, 164.81, 196.00, 246.94];
  for (const hz of CHORD) inputs.push('-f', 'lavfi', '-t', total.toFixed(2), '-i', `sine=frequency=${hz}:sample_rate=44100`);
  const aBase = n;   // first audio input index

  // ── Video: per-frame slow Ken Burns push-in, then chained xfades ──────────
  const vParts = frames.map((_, i) =>
    `[${i}:v]fps=${FPS},zoompan=z='min(zoom+0.0010,1.10)':d=1:` +
    `x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1920x1080,setsar=1[c${i}]`
  );
  let prev = '[c0]';
  for (let i = 1; i < n; i++) {
    const offset = (i * (D - T)).toFixed(3);
    const tr = TRANSITIONS[(i - 1) % TRANSITIONS.length];
    const out = i === n - 1 ? '[vx]' : `[vv${i}]`;
    vParts.push(`${prev}[c${i}]xfade=transition=${tr}:duration=${T}:offset=${offset}${out}`);
    prev = out;
  }
  vParts.push(`[vx]format=yuv420p,fade=t=in:st=0:d=0.5,fade=t=out:st=${(total - 0.6).toFixed(3)}:d=0.6[v]`);

  // ── Audio: mix the chord, warm it, add space + slow swell, fade in/out ────
  const aMixIn = CHORD.map((_, k) => `[${aBase + k}:a]`).join('');
  const aFilter =
    `${aMixIn}amix=inputs=${CHORD.length}:normalize=0,` +
    `volume=0.18,` +                                    // tame the summed tones
    `tremolo=f=0.18:d=0.6,` +                           // slow gentle swell
    `lowpass=f=1500,` +                                 // soften the highs
    `aecho=0.8:0.85:600:0.3,` +                         // light ambience/space
    `afade=t=in:d=1.2,afade=t=out:st=${(total - 1.6).toFixed(3)}:d=1.6[a]`;

  const filter = [...vParts, aFilter].join(';');

  const out = path.join(DIR, 'pearl-wallet-demo.mp4');
  const args = [
    '-y', ...inputs,
    '-filter_complex', filter,
    '-map', '[v]', '-map', '[a]',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
    '-c:a', 'aac', '-b:a', '160k',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    '-shortest',
    out,
  ];
  await run(ffmpegPath, args, { maxBuffer: 1 << 26 });
  console.log(`\n  video  pearl-wallet-demo.mp4  1920x1080  ~${total.toFixed(1)}s  (Ken Burns + transitions + ambient pad)`);
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
