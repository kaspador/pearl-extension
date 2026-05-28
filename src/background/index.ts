// Background service worker. MV3 — short-lived; spins up on events and idles
// out. We use it for:
//   • Auto-lock alarm — clears the cached mnemonic from chrome.storage.session.
//   • "Immediate lock on popup close" — handled via runtime.onConnect listener
//     since the popup opens an implicit Port that disconnects on close.

const SESSION_KEY    = 'pearl.session.mnemonic';
const AUTOLOCK_ALARM = 'pearl.autolock';

async function clearSessionMnemonic(): Promise<void> {
  return new Promise(resolve => {
    chrome.storage.session.remove([SESSION_KEY], () => resolve());
  });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === AUTOLOCK_ALARM) {
    clearSessionMnemonic();
  }
});

// "Lock immediately on popup close" — listen for the popup port disconnect.
// We have no content scripts, so the only Port we get is from chrome.runtime
// keepalive when the popup is open.
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'popup') return;
  port.onDisconnect.addListener(async () => {
    const { 'pearlchain.wallet.meta': meta } = await new Promise<{[k: string]: { autoLockMins?: number }}>(
      (resolve) => chrome.storage.local.get(['pearlchain.wallet.meta'], (r) => resolve(r as {[k: string]: { autoLockMins?: number }}))
    );
    if (meta?.autoLockMins === 0) {
      clearSessionMnemonic();
    }
  });
});

// Module export so MV3's `type: "module"` SW loads cleanly.
export {};
