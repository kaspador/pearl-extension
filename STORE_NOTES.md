# Store upload notes (local — not committed)

## Files to upload (v1.2.0)
- **Chrome Web Store** → `pearl-extension.zip`
- **Firefox AMO** → add-on: `pearl-wallet-firefox.zip` · source: `pearl-extension-source.zip`
- **Website direct download (unreleased)** → already wired: the wallet page links
  `pearlchain.live/pearl-wallet-chrome-unreleased.zip` (copy of the Chrome build),
  with load-unpacked instructions, so users get it before Google approves.

No new permissions vs. the previous version → review should stay quick.

---

## "What's new" / release notes (Chrome & Firefox)

```
v1.2.0 — Pearl Name Service (.pns) + multiple accounts

• .pns names: type "alice.pns" in Send and it resolves to the address — no more
  pasting long prl1p… strings. Receive shows your own .pns name to share. Claim a
  free name at pearlchain.live/pns.
• Multiple accounts: create several accounts from your recovery phrase and switch
  instantly; import a private key (hex/WIF) or another recovery phrase as its own
  account; export an account's private key.
• 12- or 24-word phrases when creating or importing.
• New Activity tab, a PRL/USD price chart, and bottom navigation.
• Deleting a wallet now requires your password; live "passwords match" feedback.

No new permissions. Still non-custodial, no analytics, no tracking.
```

---

## Firefox AMO — Notes to reviewer

```
Feature release (1.2.0). No new permissions or hosts. Changes are JS-only:
- .pns name resolution in Send/Receive (read-only fetch to the configured
  pearlchain explorer's /api/explorer/pns endpoint).
- Multiple-account support (HD accounts + imported keys/seeds), encrypted
  locally; signing unchanged in shape (Taproot key-path) with the same pre-sign
  ownership verification.

Build (unchanged): npm ci && npm run build:firefox → dist-firefox/ matches the
uploaded zip. Source: https://github.com/kaspador/pearl-extension
```
