import { LoaderCircle } from 'lucide-react';

export function AuthButton({ label, busy, loadingLabel }: { label: string; busy: boolean; loadingLabel: string }) {
  return <button className="primary-button" type="submit" disabled={busy}>
    {busy && <LoaderCircle size={17} className="spinner" aria-hidden="true" />}
    {busy ? loadingLabel : label}
  </button>;
}
