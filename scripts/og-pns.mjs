// Generates the /pns Open Graph image (1200x630) into the explorer's public/.
// Run from the extension dir (sharp lives here): node scripts/og-pns.mjs
import sharp from 'sharp';
import { readFileSync } from 'node:fs';

const OUT  = 'E:/VIBE/pearlINS/public/pns-og.png';
const logo = readFileSync('E:/VIBE/pearlINS/public/logo.png').toString('base64');
const href = `data:image/png;base64,${logo}`;
const FONT = 'Segoe UI, Arial, sans-serif';
const BG   = '#0b100f';

const svg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#14241f"/><stop offset="1" stop-color="#0b100f"/>
    </linearGradient>
    <radialGradient id="glow" cx="26%" cy="36%" r="62%">
      <stop offset="0" stop-color="#2a5447" stop-opacity="0.9"/><stop offset="1" stop-color="#0b100f" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#glow)"/>

  <image href="${href}" x="90" y="84" width="58" height="58"/>
  <text x="164" y="124" font-family="${FONT}" font-size="26" font-weight="600" letter-spacing="4" fill="#5fae9c">PEARL NAME SERVICE</text>

  <text x="86" y="328" font-family="${FONT}" font-size="142" font-weight="700" fill="#f4f3ee">name<tspan fill="#34d399">.pns</tspan></text>

  <text x="92" y="396" font-family="${FONT}" font-size="36" fill="#d7e4df">Free, on-chain names for your Pearl address.</text>
  <text x="92" y="444" font-family="${FONT}" font-size="28" fill="#7fae9f">Send &amp; receive PEARL with a name — not a prl1p… string.</text>

  <text x="92" y="556" font-family="${FONT}" font-size="26" font-weight="700" fill="#b6c7c0">pearlchain.live</text>
  <text x="92" y="588" font-family="${FONT}" font-size="20" fill="#6f8a80">Pearl Wallet · decentralized · register free</text>
</svg>`;

await sharp(Buffer.from(svg)).flatten({ background: BG }).png().toFile(OUT);
const m = await sharp(OUT).metadata();
console.log(`pns-og.png: ${m.width}x${m.height}, channels=${m.channels}`);
