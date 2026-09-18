# Security policy

This is a wallet. A bug here can cost people their coins, so please report anything
suspicious rather than assuming someone else has.

## Reporting a vulnerability

Use **GitHub Security Advisories** on this repository (Security → Report a vulnerability).
That keeps the report private until a fix ships. Please do not open a public issue for a
vulnerability, and please do not post it in chat channels.

Useful details: the extension version, the browser and version, what you expected, what
happened, and steps to reproduce. A failing test is the clearest possible report.

You will get an acknowledgement as soon as the report is read. Fixes for anything that can
lose funds are prioritised over everything else.

## Supported versions

The latest published version is supported. Older versions are not patched: please update
from the Chrome Web Store or Firefox Add-ons.

## What is in scope

- Anything that can spend, leak or destroy a key, a recovery phrase or a coin.
- Anything that lets a page, a site or another extension reach wallet data.
- Transactions built incorrectly: wrong recipient, wrong amount, wrong change, or a `.pns`
  name sent somewhere other than the intended owner.
- Weaknesses in the vault: key derivation, encryption, or data left unencrypted at rest.

## What is out of scope

- The Pearl node and its consensus rules. Report those at
  https://github.com/pearl-research-labs/pearl.
- The explorer backends the wallet talks to.
- Phishing, fake copies of the extension, or a compromised device. The wallet cannot defend a
  browser profile an attacker already controls.

## What this wallet does not do yet

- No hardware-wallet support, so keys live in the browser profile.
- No connection to websites: there is no injected provider, and no page can ask the wallet to
  sign anything. Any behaviour that contradicts this is a vulnerability, so please report it.
