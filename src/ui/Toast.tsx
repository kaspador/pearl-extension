// Lightweight non-blocking toast — mirrors the mobile wallet's pattern
// (e:\VIBE\pearlchain-mobile\src\ui\toast.tsx). Module-level emit listener,
// host component subscribes. 1700ms display, auto-fades.

import { useEffect, useState } from 'react';

type Listener = (msg: string) => void;
let listener: Listener | null = null;

export function toast(msg: string): void {
  listener?.(msg);
}

export function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    listener = (m) => {
      setMsg(m);
      window.setTimeout(() => setMsg(null), 1700);
    };
    return () => { listener = null; };
  }, []);
  if (!msg) return null;
  return (
    <div
      className="fixed inset-x-0 bottom-3 flex justify-center pointer-events-none z-50"
      role="status"
      aria-live="polite"
    >
      <div className="px-3 py-2 rounded-full bg-pearl-200 text-ink-950 text-xs font-medium shadow-lg">
        {msg}
      </div>
    </div>
  );
}
