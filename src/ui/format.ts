// Short, well-tested formatting helpers used across screens.

export function shortAddr(a: string, head = 10, tail = 6): string {
  if (!a) return '';
  if (a.length <= head + tail + 1) return a;
  return `${a.slice(0, head)}…${a.slice(-tail)}`;
}

export function fmtUsd(n: number | null | undefined, max = 6): string {
  if (n == null || !Number.isFinite(n)) return '—';
  if (n >= 1)     return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (n >= 0.01)  return n.toLocaleString('en-US', { maximumFractionDigits: 4 });
  return n.toLocaleString('en-US', { maximumFractionDigits: max });
}

export function timeAgo(unixSec: number | null): string {
  if (!unixSec) return '';
  const diff = Math.max(0, Math.floor(Date.now() / 1000 - unixSec));
  if (diff < 45)     return 'just now';
  if (diff < 90)     return '1 min ago';
  if (diff < 3600)   return `${Math.round(diff / 60)} min ago`;
  if (diff < 7200)   return '1 hr ago';
  if (diff < 86400)  return `${Math.round(diff / 3600)} hr ago`;
  if (diff < 172800) return '1 day ago';
  return `${Math.round(diff / 86400)} days ago`;
}
