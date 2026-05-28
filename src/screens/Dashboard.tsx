// Visual structure mirrors the mobile wallet's main screen
// (e:\VIBE\pearlchain-mobile\app\wallet.tsx):
//   - Top bar: settings (gear) on the left, lock on the right
//   - Balance card: big PEARL number + USD value
//   - Address strip: short address with copy + show-QR
//   - Primary actions: Send / Receive
//   - Recent activity list
// All numbers are placeholders until the crypto + adapter port lands.

interface DashboardProps {
  onSend:     () => void;
  onSettings: () => void;
}

const SHORT_ADDR = 'prl1p…—'; // placeholder

export function Dashboard({ onSend, onSettings }: DashboardProps) {
  return (
    <div className="flex-1 flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 pt-3 pb-2.5 border-b border-ink-800">
        <button
          onClick={onSettings}
          className="text-pearl-500 hover:text-pearl-200 text-base p-1 -m-1"
          aria-label="Settings"
        >⚙</button>
        <div className="text-[10px] uppercase tracking-wider text-pearl-700">Pearl Wallet</div>
        <button
          className="text-pearl-500 hover:text-pearl-200 text-sm p-1 -m-1"
          aria-label="Lock"
        >🔒</button>
      </header>

      {/* Balance card */}
      <section className="px-5 pt-5 pb-3 text-center">
        <div className="text-[10px] uppercase tracking-wider text-pearl-600">Balance</div>
        <div className="text-3xl font-semibold mt-1 font-mono text-pearl-200">— <span className="text-base font-normal text-pearl-600">PEARL</span></div>
        <div className="text-xs text-pearl-600 mt-0.5">≈ $—</div>
      </section>

      {/* Address strip */}
      <div className="mx-5 mb-4 bg-ink-900 border border-ink-800 rounded-xl px-3 py-2.5 flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider text-pearl-700 shrink-0">Receive</span>
        <span className="font-mono text-xs text-pearl-300 truncate flex-1">{SHORT_ADDR}</span>
        <button className="text-pearl-500 hover:text-pearl-200 text-xs shrink-0" aria-label="Copy address">⧉</button>
        <button className="text-pearl-500 hover:text-pearl-200 text-xs shrink-0" aria-label="Show QR">▦</button>
      </div>

      {/* Primary actions */}
      <div className="px-5 grid grid-cols-2 gap-3 mb-5">
        <button
          onClick={onSend}
          className="pearl-btn rounded-xl py-2.5 text-sm"
        >
          ↑ Send
        </button>
        <button
          className="rounded-xl py-2.5 text-sm border border-ink-700 hover:bg-ink-800 text-pearl-300"
        >
          ↓ Receive
        </button>
      </div>

      {/* Recent activity */}
      <section className="px-5 pb-4 flex-1">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] uppercase tracking-wider text-pearl-600">Recent activity</div>
          <span className="text-[10px] text-pearl-700">last 30 days</span>
        </div>
        <div className="text-xs text-pearl-700 py-8 text-center">No activity yet.</div>
      </section>
    </div>
  );
}
