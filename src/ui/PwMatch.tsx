// Live password feedback shown under the confirm field: length requirement,
// then whether the two entries match. Shared by Create and Import.

export function PwMatch({ password, confirm }: { password: string; confirm: string }) {
  if (password.length === 0 && confirm.length === 0) return null;

  let node;
  if (password.length < 8) {
    node = <span className="text-pearl-600">Use at least 8 characters.</span>;
  } else if (confirm.length === 0) {
    node = <span className="text-pearl-600">Re-enter to confirm.</span>;
  } else if (password === confirm) {
    node = <span className="text-emerald-700 dark:text-emerald-400">✓ Passwords match</span>;
  } else {
    node = <span className="text-rose-700 dark:text-rose-400">Passwords don’t match</span>;
  }
  return <div className="text-[11px] -mt-1">{node}</div>;
}
