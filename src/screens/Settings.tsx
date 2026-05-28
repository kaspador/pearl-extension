// TODO (next turn): wire backend URL switcher (pearlchain.live ↔ Blockbook),
// auto-lock timeout, "lock now", "export 12 words" (requires password
// re-prompt), "delete wallet" with double-confirm.

export function Settings({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex-1 flex flex-col">
      <header className="flex items-center px-5 pt-4 pb-3 border-b border-ink-800 gap-3">
        <button onClick={onBack} className="text-pearl-500 hover:text-pearl-300 text-xs">←</button>
        <h1 className="text-sm font-semibold">Settings</h1>
      </header>

      <div className="p-5 flex flex-col gap-5 flex-1 text-xs">
        <section>
          <div className="text-[10px] uppercase tracking-wider text-pearl-600 mb-2">Backend</div>
          <div className="text-pearl-400">pearlchain.live · default</div>
        </section>

        <section>
          <div className="text-[10px] uppercase tracking-wider text-pearl-600 mb-2">Auto-lock</div>
          <div className="text-pearl-400">After 5 minutes</div>
        </section>

        <section className="mt-auto pt-5 border-t border-ink-800 text-[10px] text-pearl-700">
          Pearl Wallet beta · v0.1.0
        </section>
      </div>
    </div>
  );
}
