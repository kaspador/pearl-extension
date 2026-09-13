# Store upload notes (local — not committed)

## v1.3.2 (security release)

Files:
- **Chrome Web Store** → `pearl-wallet-chrome-v1.3.2.zip`
- **Firefox AMO** → add-on: `pearl-wallet-firefox-v1.3.2.zip` · source: `pearl-extension-source-v1.3.2.zip`

No new permissions or hosts.

What's new (Chrome & Firefox):

```
v1.3.2: safety fixes, please update

• Your .pns names are protected. Sending and consolidating never spend the
  coins that hold your names, and Send shows how much is spendable.
• Transferring a name always delivers it to the new owner, including when the
  transfer needs a second coin for the fee. A name on a large coin is sent on a
  small carrier and the rest comes back to you.
• Send only accepts address types that exist on Pearl. Addresses that any miner
  could take funds from, or that nobody could ever spend, are refused.
• Stronger password protection: your wallet is re-encrypted with 6x stronger
  key stretching the next time you unlock. Unlocking is not slower.
• Updated cryptography and build libraries.

Still non-custodial, no analytics, no tracking.
```

Firefox AMO, notes to reviewer:

```
Security release (1.3.2). No new permissions or hosts. JS-only changes:
- Recipient validation limited to witness v1/v2 32-byte programs.
- Name (inscription) coins excluded from ordinary spends; name transfer puts
  the recipient at output 0.
- Vault KDF: PBKDF2-SHA256 600k via WebCrypto (v2 box), v1 boxes still open
  and are re-sealed after a successful unlock.
- Dependencies: @noble/* and @scure/* 2.4, vite 7, vitest 4.

Build (unchanged): npm ci && npm run build:firefox → dist-firefox/ matches the
uploaded zip. Node v20.19+ or v22.12+.
```

---

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
