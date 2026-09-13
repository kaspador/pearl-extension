// Generates the Chrome Web Store promo images (no-alpha 24-bit PNG):
//   • promo-small-440x280.png    (small promo tile)
//   • promo-marquee-1400x560.png (marquee)
// Run: node scripts/promo.mjs
import sharp from 'sharp';
import { readFileSync } from 'node:fs';

const icon = readFileSync('src/assets/icon-128.png').toString('base64');
const href = `data:image/png;base64,${icon}`;
const FONT = 'Segoe UI, Arial, sans-serif';
const BG   = '#0b100f';

const small = `<svg width="440" height="280" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#13211e"/><stop offset="1" stop-color="#0b100f"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="26%" r="65%">
      <stop offset="0" stop-color="#23463c" stop-opacity="0.9"/><stop offset="1" stop-color="#0b100f" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="440" height="280" fill="url(#bg)"/>
  <rect width="440" height="280" fill="url(#glow)"/>
  <image href="${href}" x="174" y="38" width="92" height="92"/>
  <text x="220" y="184" text-anchor="middle" font-family="${FONT}" font-size="40" font-weight="700" fill="#f4f3ee">Pearl Wallet</text>
  <text x="220" y="216" text-anchor="middle" font-family="${FONT}" font-size="15" font-weight="600" letter-spacing="3" fill="#79b6a7">SECURE · SIMPLE · ONCHAIN</text>
</svg>`;

const marquee = `<svg width="1400" height="560" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#13211e"/><stop offset="1" stop-color="#0b100f"/>
    </linearGradient>
    <radialGradient id="glow" cx="20%" cy="50%" r="55%">
      <stop offset="0" stop-color="#264c41" stop-opacity="0.85"/><stop offset="1" stop-color="#0b100f" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1400" height="560" fill="url(#bg)"/>
  <rect width="1400" height="560" fill="url(#glow)"/>
  <image href="${href}" x="120" y="168" width="224" height="224"/>
  <text x="396" y="252" font-family="${FONT}" font-size="104" font-weight="700" fill="#f4f3ee">Pearl Wallet</text>
  <text x="402" y="314" font-family="${FONT}" font-size="30" fill="#d7e4df">The non-custodial wallet for the Pearl blockchain</text>
  <text x="402" y="374" font-family="${FONT}" font-size="25" font-weight="600" letter-spacing="1" fill="#5fae9c">Multiple accounts · BIP-86 Taproot · Send &amp; receive PEARL · No tracking</text>
</svg>`;

for (const [svg, out] of [[small, 'promo-small-440x280.png'], [marquee, 'promo-marquee-1400x560.png']]) {
  await sharp(Buffer.from(svg)).flatten({ background: BG }).png().toFile(out);
  const m = await sharp(out).metadata();
  console.log(`${out}: ${m.width}x${m.height}, channels=${m.channels} (3 = no alpha)`);
}
