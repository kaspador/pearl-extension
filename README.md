# Pearl Wallet — Chrome Extension

Community-built non-custodial Chrome extension wallet for the **Pearl blockchain** (Proof-of-Useful-Work).

> **Status:** v0.1.0 scaffold — UI shell + build pipeline only. Crypto + send/receive land in subsequent commits.

## Stack

- **Manifest V3** (Chrome's required format since 2023)
- **React 18** + TypeScript
- **Vite** + [`@crxjs/vite-plugin`](https://github.com/crxjs/chrome-extension-tools) (HMR-aware extension build)
- **Tailwind v4** (matches `pearlchain.live`)
- **`@noble/*`** for all crypto (curves, hashes, bip32, bip39, base) — wasm-free, runs inside MV3's strict CSP
- **`chrome.storage.local`** + WebCrypto AES-GCM for the encrypted vault

## Dev

```bash
npm install
npm run dev          # vite dev server on :5173 with HMR
```

Then load the extension in Chrome:

1. `chrome://extensions`
2. Toggle **Developer mode** (top right)
3. **Load unpacked** → select the `dist/` folder
4. Pin the toolbar icon

Subsequent edits hot-reload (no manual extension reload needed) thanks to `@crxjs/vite-plugin`.

## Build for Web Store

```bash
npm run package      # → pearl-extension.zip
```

Upload the zip on the [Chrome Web Store dev dashboard](https://chrome.google.com/webstore/devconsole).

## Architecture

```
src/
├── manifest.ts          MV3 manifest (TS so vite can inline asset paths)
├── popup/               Toolbar popup — main UX (360×540)
├── options/             Full-window setup/seed-phrase flow
├── background/          MV3 service worker (alarms, future provider routing)
├── screens/             Onboarding · Dashboard · Send · Settings
├── pearl/               Pearl crypto (port from mobile, web-shimmed)
├── api/                 Blockbook v2 + pearlchain.live adapters
├── storage/             chrome.storage.local + WebCrypto vault
├── styles/              Tailwind v4 entry + theme
└── assets/              Toolbar / store icons
```

## Roadmap

- [x] v0.1.0 — scaffold + build pipeline + 4 stub screens
- [ ] v0.1.1 — port crypto (BIP-39/32/86 + tx signing) and Blockbook adapter
- [ ] v0.1.2 — onboarding (create / import / password / vault encrypt)
- [ ] v0.1.3 — dashboard balance + receive QR
- [ ] v0.1.4 — send (UTXO select + sign + broadcast)
- [ ] v0.1.5 — settings (backend toggle, auto-lock, export, delete)
- [ ] v0.2.0 — WebAuthn biometric unlock
- [ ] v0.3.0 — `window.pearl` dApp provider injection
- [ ] v0.4.0 — Ledger hardware-wallet support

## Distribution

Same plan as the mobile wallet:
- **Chrome Web Store** (no organization-account requirement for extensions, unlike Play)
- **Direct .zip** from [github.com/kaspador/pearlwallet-releases](https://github.com/kaspador/pearlwallet-releases) — load unpacked

## License

Source private during beta. Builds redistributable for personal use.
