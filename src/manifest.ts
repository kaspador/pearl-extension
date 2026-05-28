// Chrome Manifest V3 definition for Pearl Wallet. Kept in TS (not raw JSON) so
// @crxjs/vite-plugin can inline the popup/options HTML paths, hash the
// service worker, and rewrite asset URLs at build time.

import { defineManifest } from '@crxjs/vite-plugin';
import pkg from '../package.json';

export default defineManifest({
  manifest_version: 3,
  name: 'Pearl Wallet',
  short_name: 'Pearl',
  version: pkg.version,
  description: pkg.description,

  // Popup is the main UX surface (click the toolbar icon).
  action: {
    default_title: 'Pearl Wallet',
    default_popup: 'src/popup/index.html',
    default_icon: {
      '16':  'src/assets/icon-16.png',
      '32':  'src/assets/icon-32.png',
      '48':  'src/assets/icon-48.png',
      '128': 'src/assets/icon-128.png',
    },
  },

  icons: {
    '16':  'src/assets/icon-16.png',
    '32':  'src/assets/icon-32.png',
    '48':  'src/assets/icon-48.png',
    '128': 'src/assets/icon-128.png',
  },

  // Background service worker (MV3) — used for long-running tasks like
  // periodic balance refresh and auto-lock timer. Stays minimal in v0.1.
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },

  // Full-page for onboarding (seed display) — the popup is too small to
  // safely show a 12-word phrase. Opened via chrome.tabs.create().
  options_page: 'src/options/index.html',

  permissions: [
    'storage',          // encrypted vault lives in chrome.storage.local
    'alarms',           // periodic auto-lock + balance refresh
  ],

  host_permissions: [
    // Default Pearl backends — required so fetch() works from the popup.
    'https://pearlchain.live/*',
    'https://blockbook.pearlresearch.ai/*',
  ],

  // No content_scripts, no externally_connectable in v0.1 — those land
  // when we add the window.pearl dApp provider in v0.2.

  content_security_policy: {
    extension_pages:
      // Strict CSP — no inline scripts, no eval. WebCrypto and noble libs
      // are wasm-free and work under this.
      "script-src 'self'; object-src 'self'; style-src 'self' 'unsafe-inline';",
  },
});
