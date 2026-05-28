// TODO (next turn): wire address validation (prl1p…), fee tier selector,
// UTXO selection, sign-with-noble, broadcast via blockbook adapter.

export function Send({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex-1 flex flex-col">
      <header className="flex items-center px-5 pt-4 pb-3 border-b border-ink-800 gap-3">
        <button onClick={onBack} className="text-pearl-500 hover:text-pearl-300 text-xs">←</button>
        <h1 className="text-sm font-semibold">Send PEARL</h1>
      </header>

      <div className="p-5 flex flex-col gap-4 flex-1">
        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-pearl-600">Recipient</span>
          <input
            placeholder="prl1p…"
            className="mt-1 w-full bg-ink-800 border border-ink-700 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-pearl-700"
          />
        </label>

        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-pearl-600">Amount</span>
          <div className="mt-1 flex">
            <input
              placeholder="0.0"
              inputMode="decimal"
              className="flex-1 bg-ink-800 border border-ink-700 rounded-l-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-pearl-700"
            />
            <span className="px-3 py-2 bg-ink-700 border border-ink-700 rounded-r-lg text-xs">PEARL</span>
          </div>
        </label>

        <button disabled className="pearl-btn rounded-xl py-2.5 text-sm mt-auto">
          Review &amp; send
        </button>
      </div>
    </div>
  );
}
