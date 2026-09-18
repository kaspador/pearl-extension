# Firefox build

The same source builds for both Chrome and Firefox. The wallet JS is identical —
our `chrome.*` callback APIs (storage/alarms/runtime) work in Firefox's
chrome-compat namespace. Only the **manifest** differs, and that's generated
automatically.

## Build

```bash
npm run build            # Chrome  → dist/            (MV3 service_worker)
npm run build:firefox    # Firefox → dist-firefox/    (MV3 event-page background + gecko id)

npm run package          # Chrome  → pearl-extension.zip
npm run package:firefox  # Firefox → pearl-wallet-firefox.zip
```

`build:firefox` runs the normal Vite build, then `scripts/build-firefox.mjs`
copies `dist/ → dist-firefox/` and rewrites `manifest.json`:
- `background.service_worker` → `background.scripts` (Firefox MV3 uses an
  event page, not a service worker; our background has no SW-only APIs).
- adds `browser_specific_settings.gecko.id = pearl-wallet@pearlchain.live`
  (`strict_min_version: 140.0`; Firefox for Android needs 142+).

Chrome's `dist/` is never modified.

## Test in Firefox

1. `npm run build:firefox`
2. Firefox → `about:debugging` → **This Firefox** → **Load Temporary Add-on…**
3. Select `dist-firefox/manifest.json`.
4. Exercise create/import/unlock, balance, send/receive, auto-lock. Temporary
   add-ons unload on restart — reload after each rebuild.

## Publish (AMO)

Submit `pearl-wallet-firefox.zip` at https://addons.mozilla.org/developers/ .
AMO signs it (free). The `gecko.id` above must stay stable across versions.

## Notes / caveats

- Requires **Firefox 140+** (142+ on Android).
- If a future change adds a service-worker-only API (e.g. `fetch`/`install`
  events, `clients`, `skipWaiting`), the Firefox event-page background would
  need a separate entry — none are used today.
- The default backend is `https://pearlchain.live` (same as Chrome); host
  permissions are unchanged.
