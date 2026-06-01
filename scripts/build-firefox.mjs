// Post-build: turn the Chrome MV3 `dist/` into a Firefox-compatible
// `dist-firefox/`. The bundled JS is left UNCHANGED — our chrome.* callback
// APIs (storage/alarms/runtime/tabs) work as-is in Firefox's chrome-compat
// namespace. Only the manifest differs:
//   • Firefox MV3 uses an event-page background (`scripts`), not a service
//     worker. Our background uses no SW-only APIs, so the same bundle loads
//     fine as a module background script.
//   • Firefox requires an explicit add-on id (browser_specific_settings.gecko).
//
// Run after `vite build` (see the `build:firefox` npm script).
import { cpSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';

const SRC = 'dist';
const OUT = 'dist-firefox';
const GECKO_ID = 'pearl-wallet@pearlchain.live';

if (!existsSync(`${SRC}/manifest.json`)) {
  console.error(`No ${SRC}/manifest.json — run "npm run build" first.`);
  process.exit(1);
}

rmSync(OUT, { recursive: true, force: true });
cpSync(SRC, OUT, { recursive: true });

const mfPath = `${OUT}/manifest.json`;
const m = JSON.parse(readFileSync(mfPath, 'utf8'));

// Chrome's service-worker background → Firefox's event-page background script.
if (m.background?.service_worker) {
  m.background = {
    scripts: [m.background.service_worker],
    type: m.background.type ?? 'module',
  };
}

// Stable add-on id + minimum version (MV3 module background needs Firefox 121+).
m.browser_specific_settings = {
  ...(m.browser_specific_settings ?? {}),
  gecko: { id: GECKO_ID, strict_min_version: '121.0' },
};

writeFileSync(mfPath, `${JSON.stringify(m, null, 2)}\n`);
console.log(`✓ ${OUT}/ ready (Firefox MV3) — background=scripts, gecko.id=${GECKO_ID}`);
console.log(`  Test: Firefox → about:debugging → This Firefox → Load Temporary Add-on → ${OUT}/manifest.json`);
