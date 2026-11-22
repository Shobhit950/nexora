import { ChevronDown, LogOut, Menu } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { authError, type User } from '../../auth/api';
import { DashboardAvatar } from './DashboardAvatar';

type HeaderProps = {
  user: User;
  hasUnsavedChanges: boolean;
  onOpenNavigation: () => void;
};

export function DashboardHeader({ user, hasUnsavedChanges, onOpenNavigation }: HeaderProps) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const account = useRef<HTMLDivElement>(null);
  const accountButton = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;

    function dismiss(event: PointerEvent) {
      if (event.target instanceof Node && !account.current?.contains(event.target)) setOpen(false);
    }

    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);

  async function signOut() {
    if (busy || (hasUnsavedChanges && !window.confirm('Sign out and discard your unsaved workflow changes?'))) return;
    setBusy(true);
    setError('');
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (error) {
      setError(authError(error, 'Unable to sign out. Try again.').message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <header className="dashboard-header">
      <div className="dashboard-header-inner">
        <div className="dashboard-header-title">
          <button
            type="button"
            className="dashboard-icon-button dashboard-mobile-toggle"
            aria-label="Open navigation"
            aria-haspopup="dialog"
            onClick={onOpenNavigation}
          >
            <Menu size={21} />
          </button>
          <span>Workspace</span>
        </div>

        <div
          className="dashboard-account"
          ref={account}
          onBlur={event => {
            if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
          }}
          onKeyDown={event => {
            if (event.key === 'Escape' && open) {
              setOpen(false);
              accountButton.current?.focus();
            }
          }}
        >
          <button
            type="button"
            className="dashboard-account-trigger"
            ref={accountButton}
            aria-label={'Account for ' + user.name}
            aria-expanded={open}
            aria-controls="dashboard-account-panel"
            onClick={() => setOpen(!open)}
          >
            <DashboardAvatar name={user.name} />
            <span className="dashboard-account-name">{user.name}</span>
            <ChevronDown size={16} aria-hidden="true" className="dashboard-account-chevron" />
          </button>
          <div id="dashboard-account-panel" className="dashboard-account-panel" data-open={open} inert={!open} aria-hidden={!open}>
            <div className="dashboard-account-identity">
              <strong>{user.name}</strong>
              <span>{user.email}</span>
            </div>
            <button
              type="button"
              className="dashboard-signout"
              aria-disabled={busy}
              aria-busy={busy}
              onClick={signOut}
            >
              <LogOut size={17} aria-hidden="true" />
              {busy ? 'Signing out…' : 'Sign out'}
            </button>
            {error && <p className="dashboard-account-error" role="alert">{error}</p>}
          </div>
        </div>
      </div>
    </header>
  );
}
