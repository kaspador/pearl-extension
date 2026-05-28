// Theme controller. Three modes:
//   • 'light' — force light
//   • 'dark'  — force dark
//   • 'system' — follow the OS / browser pref (default)
//
// The chosen mode lives in chrome.storage.local (persistent), so popup and
// options page see the same value. A single `applyTheme()` call mutates
// the <html class="dark"> bit; everything else is driven by CSS variables.

export type ThemeMode = 'light' | 'dark' | 'system';
const THEME_KEY = 'pearl.theme';

export async function loadTheme(): Promise<ThemeMode> {
  return new Promise(resolve => {
    chrome.storage.local.get([THEME_KEY], (res) => resolve((res[THEME_KEY] as ThemeMode) ?? 'system'));
  });
}

export async function saveTheme(mode: ThemeMode): Promise<void> {
  return new Promise(resolve => { chrome.storage.local.set({ [THEME_KEY]: mode }, () => resolve()); });
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined'
      && !!window.matchMedia
      && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function applyTheme(mode: ThemeMode): void {
  const useDark = mode === 'dark' || (mode === 'system' && systemPrefersDark());
  document.documentElement.classList.toggle('dark', useDark);
}

// Convenience: read storage and apply in one call. Returns the resolved mode.
export async function initTheme(): Promise<ThemeMode> {
  const mode = await loadTheme();
  applyTheme(mode);
  return mode;
}

// React to system pref changes while a page is open (only matters when
// mode === 'system'). Returns an unsubscribe fn.
export function watchSystem(onChange: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const fn = () => onChange();
  mq.addEventListener('change', fn);
  return () => mq.removeEventListener('change', fn);
}
