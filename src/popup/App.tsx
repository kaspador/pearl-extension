import { useState } from 'react';
import { Onboarding } from '@/screens/Onboarding';
import { Dashboard } from '@/screens/Dashboard';
import { Send }       from '@/screens/Send';
import { Settings }   from '@/screens/Settings';

export type Screen = 'onboarding' | 'dashboard' | 'send' | 'settings';

// Top-level router. We deliberately roll our own (no react-router) because
// the popup has only ~5 screens and react-router adds 50KB + URL semantics
// that don't apply to an extension popup.
export function App() {
  // TODO: once vault load is wired, default-route to 'onboarding' if no
  // wallet exists, else 'dashboard'.
  const [screen, setScreen] = useState<Screen>('onboarding');

  return (
    <div className="popup-shell flex flex-col">
      {screen === 'onboarding' && <Onboarding onDone={() => setScreen('dashboard')} />}
      {screen === 'dashboard'  && <Dashboard onSend={() => setScreen('send')} onSettings={() => setScreen('settings')} />}
      {screen === 'send'       && <Send onBack={() => setScreen('dashboard')} />}
      {screen === 'settings'   && <Settings onBack={() => setScreen('dashboard')} />}
    </div>
  );
}
