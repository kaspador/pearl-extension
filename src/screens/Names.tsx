// My .pns names: list the names this account owns and transfer them one by one.
//
// "Own" = this account holds the inscription coin (txid:vout) the indexer tracks.
// A transfer spends that exact coin to the recipient; ownership follows the coin.

import { useState, useEffect, useCallback } from 'react';
import { isValidAddress } from '@/pearl/address';
import { formatPearl } from '@/pearl/network';
import { buildPnsTransferTx } from '@/pearl/transaction';
import { broadcastTx, resolvePns, pnsOwnedBy } from '@/api/client';
import { getCache, refreshWallet } from '@/state/walletState';
import { buildCurrentSigner } from '@/state/accounts';
import { loadMeta } from '@/storage/vault';
import { toast } from '@/ui/Toast';
import { ScreenHeader } from '@/ui/ScreenHeader';
import type { ScannedUtxo } from '@/pearl/hdwallet';

interface HeldName { name: string; utxo: ScannedUtxo }

export function Names({ onBack }: { onBack: () => void }) {
  const [loading, setLoading]   = useState(true);
  const [held, setHeld]         = useState<HeldName[]>([]);
  const [transfer, setTransfer] = useState<HeldName | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const scan = getCache().scan;
    if (!scan) { setHeld([]); setLoading(false); return; }

    // A name's inscription coin lives at one of this account's addresses, so we
    // only need to query the addresses that actually hold UTXOs.
    const addrs = Array.from(new Set(scan.utxos.map(u => u.address)));
    const utxoByKey = new Map(scan.utxos.map(u => [`${u.txid}:${u.vout}`, u]));
    const results = await Promise.all(addrs.map(a => pnsOwnedBy(a)));

    const seen = new Set<string>();
    const list: HeldName[] = [];
    for (const owned of results) {
      for (const o of owned) {
        if (seen.has(o.name)) continue;
        const utxo = utxoByKey.get(`${o.inscTxid}:${o.inscVout}`);
        if (utxo) { seen.add(o.name); list.push({ name: o.name, utxo }); }
      }
    }
    list.sort((a, b) => a.name.localeCompare(b.name));
    setHeld(list);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (transfer) {
    return (
      <TransferName
        held={transfer}
        onBack={() => setTransfer(null)}
        onDone={async () => { setTransfer(null); await refreshWallet(); await load(); }}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <ScreenHeader title="My .pns names" onBack={onBack} />
      <div className="flex-1 min-h-0 overflow-y-auto p-5 flex flex-col gap-3">
        {loading ? (
          <div className="text-sm text-pearl-600 text-center py-10">Loading your names…</div>
        ) : held.length === 0 ? (
          <div className="text-center py-10 space-y-2">
            <div className="text-sm text-pearl-500">This account doesn&apos;t own any .pns names.</div>
            <a href="https://pearlchain.live/pns" target="_blank" rel="noreferrer"
               className="inline-block text-xs text-pearl-400 underline decoration-pearl-700">Register one ↗</a>
          </div>
        ) : held.map(h => (
          <div key={h.name} className="bg-ink-900 border border-ink-700 rounded-xl p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-pearl-200 font-mono truncate">{h.name}.pns</div>
              <div className="text-[11px] text-pearl-600 font-mono truncate">{h.utxo.txid.slice(0, 10)}…:{h.utxo.vout}</div>
            </div>
            <button onClick={() => setTransfer(h)} className="seg tap rounded-lg px-3 py-1.5 text-xs shrink-0">Transfer</button>
          </div>
        ))}
      </div>
    </div>
  );
}

type Step = 'form' | 'review' | 'broadcast';

function TransferName({ held, onBack, onDone }: { held: HeldName; onBack: () => void; onDone: () => void }) {
  const [step, setStep]         = useState<Step>('form');
  const [recipient, setRecip]   = useState('');
  const [pns, setPns]           = useState<{ name: string; address: string } | null>(null);
  const [pnsChecking, setChk]   = useState(false);
  const [busy, setBusy]         = useState(false);

  // Resolve a typed .pns name → address (debounced); raw addresses skip it.
  useEffect(() => {
    const raw = recipient.trim().toLowerCase();
    if (raw === '' || raw.startsWith('prl1') || raw.startsWith('tprl1')) { setPns(null); setChk(false); return; }
    const name = raw.replace(/\.pns$/, '');
    if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(name)) { setPns(null); setChk(false); return; }
    let cancelled = false;
    setChk(true);
    const t = setTimeout(async () => {
      const addr = await resolvePns(name);
      if (!cancelled) { setPns(addr ? { name, address: addr } : null); setChk(false); }
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [recipient]);

  const effectiveRecipient = pns?.address ?? recipient.trim();
  const addrValid = isValidAddress(effectiveRecipient);
  const toSelf = addrValid && effectiveRecipient === held.utxo.address;

  async function doTransfer() {
    const c = getCache();
    if (!c.scan) return;
    setBusy(true);
    try {
      const meta = await loadMeta();
      const network = meta?.network ?? 'mainnet';
      const signer = await buildCurrentSigner(network);
      const tx = buildPnsTransferTx({
        signer, network,
        recipient: effectiveRecipient,
        inscriptionUtxo: held.utxo,
        feeUtxos: c.scan.utxos,
        protectedOutpoints: c.protectedOutpoints,
        feeRate: BigInt(c.feeRate ?? 1),
        changeAddress: c.scan.nextChangeAddress || c.scan.receiveAddress,
      });
      setStep('broadcast');
      const res = await broadcastTx(tx.hex);
      if (res.txid) { toast('Transfer broadcast!'); onDone(); }
      else { toast(res.error ?? 'Broadcast failed'); setStep('review'); }
    } catch (e) {
      toast((e as Error).message);
      setStep('review');
    } finally { setBusy(false); }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <ScreenHeader title={`Transfer ${held.name}.pns`} onBack={() => step === 'form' ? onBack() : setStep('form')} />

      {step === 'form' && (
        <div className="flex-1 min-h-0 overflow-y-auto p-5 flex flex-col gap-4">
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-pearl-600 font-semibold">New owner</span>
            <input
              value={recipient}
              onChange={(e) => setRecip(e.target.value)}
              placeholder="prl1p… or name.pns"
              spellCheck={false} autoCorrect="off" autoCapitalize="off"
              className="mt-1 w-full bg-ink-900 border border-ink-700 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-pearl-700 text-pearl-200"
            />
            {pns ? (
              <div className="text-xs text-emerald-700 dark:text-emerald-400 mt-1 font-mono break-all">✓ {pns.name}.pns → {pns.address.slice(0, 14)}…{pns.address.slice(-6)}</div>
            ) : pnsChecking ? (
              <div className="text-xs text-pearl-600 mt-1">resolving .pns…</div>
            ) : recipient && !addrValid ? (
              <div className="text-xs text-rose-700 dark:text-rose-400 mt-1">
                {!/^t?prl1/i.test(recipient.trim()) && /^[a-z0-9][a-z0-9-]{0,62}(\.pns)?$/i.test(recipient.trim()) ? 'No .pns name found' : 'Invalid Pearl address'}
              </div>
            ) : toSelf ? (
              <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">That&apos;s this name&apos;s current address — pick a different owner.</div>
            ) : null}
          </label>

          <p className="text-xs text-pearl-600 leading-relaxed">
            Transferring sends <span className="text-pearl-300 font-mono">{held.name}.pns</span> to the address above. This is
            <span className="text-pearl-300"> permanent</span> — once mined, only the new owner can control or move the name.
          </p>

          <button
            disabled={!addrValid || toSelf}
            onClick={() => setStep('review')}
            className="pearl-btn rounded-xl py-3 text-sm mt-auto"
          >
            Review transfer
          </button>
        </div>
      )}

      {step === 'review' && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 min-h-0 overflow-y-auto p-5 flex flex-col gap-4">
            <div className="bg-ink-900 border border-ink-700 rounded-xl p-4 space-y-3 text-sm">
              <div>
                <div className="text-pearl-600 text-[11px] uppercase tracking-wider font-semibold mb-1">Name</div>
                <div className="font-mono text-pearl-200">{held.name}.pns</div>
              </div>
              <div>
                <div className="text-pearl-600 text-[11px] uppercase tracking-wider font-semibold mb-1">New owner</div>
                {pns && <div className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold mb-0.5">{pns.name}.pns</div>}
                <div className="font-mono text-xs text-pearl-200 break-all leading-relaxed">{effectiveRecipient}</div>
              </div>
              <div>
                <div className="text-pearl-600 text-[11px] uppercase tracking-wider font-semibold mb-1">Coin spent</div>
                <div className="font-mono text-[11px] text-pearl-400 break-all">{held.utxo.txid}:{held.utxo.vout} ({formatPearl(held.utxo.value, 8)} PEARL)</div>
              </div>
            </div>
            <p className="text-xs text-pearl-600 leading-relaxed">
              Final once mined (~3 min). The name will move to the new owner and disappear from this wallet.
            </p>
          </div>
          <div className="px-5 pt-2 pb-4 border-t border-ink-700 shrink-0">
            <button disabled={busy} onClick={doTransfer} className="pearl-btn rounded-xl py-3 text-sm w-full">
              {busy ? 'Signing…' : 'Sign & transfer'}
            </button>
          </div>
        </div>
      )}

      {step === 'broadcast' && (
        <div className="p-5 flex-1 flex items-center justify-center text-sm text-pearl-500">Broadcasting…</div>
      )}
    </div>
  );
}
