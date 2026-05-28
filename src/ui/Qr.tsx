// QR code component. Uses the `qrcode` npm package to render to a data URL.
// Keeps things sync via useEffect+useState (lib is async).

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export function Qr({ value, size = 192 }: { value: string; size?: number }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(value, {
      errorCorrectionLevel: 'M', margin: 2, scale: 6,
      color: { dark: '#111110', light: '#f0efea' },
    }).then(u => { if (alive) setUrl(u); }).catch(() => { /* ignore */ });
    return () => { alive = false; };
  }, [value]);
  if (!url) return <div style={{ width: size, height: size }} className="bg-ink-800 rounded-lg" />;
  return (
    <img
      src={url}
      width={size}
      height={size}
      alt="QR code"
      className="rounded-lg bg-pearl-200"
      style={{ width: size, height: size }}
    />
  );
}
