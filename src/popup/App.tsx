import { useEffect, useState } from 'react';
import { Onboarding } from '@/screens/Onboarding';
import { Import }     from '@/screens/Import';
import { Unlock }     from '@/screens/Unlock';
import { Dashboard }  from '@/screens/Dashboard';
import { Send }       from '@/screens/Send';
import { Receive }    from '@/screens/Receive';
import { Settings }   from '@/screens/Settings';
import { ToastHost, toast } from '@/ui/Toast';
import { hasWallet, loadMeta } from '@/storage/vault';
import { isUnlocked, restoreFromSession } from '@/state/session';
import { setBackend } from '@/api/client';

export type Screen =
  | 'loading'
  | 'onboarding' | 'import' | 'unlock'
  | 'dashboard' | 'send' | 'receive' | 'settings';

export function App() {
  const [screen, setScreen] = useState<Screen>('loading');

  // On mount: open a port to the SW (so it can detect popup-close for the
  // "lock immediately" auto-lock mode), load backend config, then decide
  // initial screen.
  useEffect(() => {
    const port = chrome.runtime.connect({ name: 'popup' });
    (async () => {
      const meta = await loadMeta();
      if (meta?.explorerUrl && meta?.explorerMode) {
        setBackend(meta.explorerUrl, meta.explorerMode);
      }
      const exists = await hasWallet();
      if (!exists) { setScreen('onboarding'); return; }
      // Try to restore the unlocked session from chrome.storage.session.
      const restored = isUnlocked() || (await restoreFromSession());
      setScreen(restored ? 'dashboard' : 'unlock');
    })();
    return () => { port.disconnect(); };
  }, []);

  return (
    <div className="popup-shell flex flex-col">
      {screen === 'loading' && (
        <div className="flex-1 flex items-center justify-center text-xs text-pearl-600">Loading…</div>
      )}

      {screen === 'onboarding' && (
        <Onboarding onImport={() => setScreen('import')} />
      )}

      {screen === 'import' && (
        <Import
          onBack={() => setScreen('onboarding')}
          onDone={() => setScreen('dashboard')}
        />
      )}

      {screen === 'unlock' && (
        <Unlock onUnlocked={() => setScreen('dashboard')} />
      )}

      {screen === 'dashboard' && (
        <Dashboard
          onSend={() => setScreen('send')}
          onReceive={() => setScreen('receive')}
          onSettings={() => setScreen('settings')}
          onLocked={() => setScreen('unlock')}
        />
      )}

      {screen === 'send' && (
        <Send
          onBack={() => setScreen('dashboard')}
          onSent={(txid) => { toast(`Sent: ${txid.slice(0, 10)}…`); setScreen('dashboard'); }}
        />
      )}

      {screen === 'receive' && (
        <Receive onBack={() => setScreen('dashboard')} />
      )}

      {screen === 'settings' && (
        <Settings
          onBack={() => setScreen('dashboard')}
          onLocked={() => setScreen(/* if wallet still exists */ 'unlock')}
        />
      )}

      <ToastHost />
    </div>
  );
}
