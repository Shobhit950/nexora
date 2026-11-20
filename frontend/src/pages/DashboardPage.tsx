import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { authError } from '../auth/api';
import { useAuth } from '../auth/AuthProvider';
import { AuthButton } from '../components/AuthButton';

export function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
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
    <main className="form-panel min-h-svh">
      <section className="auth-card" aria-labelledby="account-title">
        <h2 id="account-title">{user?.name}</h2>
        <p className="form-intro">{user?.email}</p>
        <form onSubmit={submit} aria-busy={busy}>
          {error && <p className="form-message" role="alert">{error}</p>}
          <AuthButton label="Sign out" busy={busy} loadingLabel="Signing out…" />
        </form>
      </section>
    </main>
  );
}
