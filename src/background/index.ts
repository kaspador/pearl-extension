// Background service worker. In MV3 this is *not* a long-lived process — it
// spins up on event and idles out. We use it for:
//   • Periodic balance refresh via chrome.alarms (every 60s while unlocked)
//   • Auto-lock timer (clears in-memory session keys after configured idle)
//   • Future: window.pearl provider message routing
//
// v0.1: stub so the worker registers correctly. Real wiring lands once the
// vault + adapter modules are ported.

self.addEventListener('install', () => {
  console.log('[pearl] sw installed');
});

self.addEventListener('activate', () => {
  console.log('[pearl] sw active');
});

// Keep the file a module so MV3 service-worker type:module loads it.
export {};
