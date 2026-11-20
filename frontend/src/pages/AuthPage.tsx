import { CircleAlert, LockKeyhole, Mail, UserRound } from 'lucide-react';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { authError, signup as register } from '../auth/api';
import { useAuth } from '../auth/AuthProvider';
import { AuthButton } from '../components/AuthButton';
import { AuthInput } from '../components/AuthInput';
import { AuthLayout } from '../components/AuthLayout';

type Field = 'name' | 'email' | 'password' | 'confirmation';
type Errors = Partial<Record<Field, string>>;
const encoder = new TextEncoder();

function passwordStrength(password: string) {
  if (!password || password.length < 8) return 0;
  return Math.min(4, 1 + Number(password.length >= 12) + Number(/[A-Z]/.test(password) && /[a-z]/.test(password)) + Number(/\d/.test(password) || /[^\p{L}\p{N}\s]/u.test(password)));
}

export function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const signup = mode === 'signup';
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const signupComplete = !signup && location.state?.signupComplete === true;
  const strengthId = useId();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const score = passwordStrength(password);

  useEffect(() => {
    document.title = (signup ? 'Create an account' : 'Sign in') + ' | Nexora';
  }, [signup]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setFormError('');
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get('name') ?? '').trim();
    const email = String(data.get('email') ?? '').trim();
    const secret = String(data.get('password') ?? '');
    const next: Errors = {};
    if (signup && (!name || name.length > 100)) next.name = 'Enter a name up to 100 characters.';
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = 'Enter a valid email address.';
    if (!secret) next.password = 'Enter your password.';
    else if (signup && secret.length < 8) next.password = 'Use at least 8 characters.';
    else if (encoder.encode(secret).length > 72) next.password = 'Use a password of at most 72 bytes.';
    if (signup && data.get('confirmation') !== secret) next.confirmation = 'Passwords must match.';
    setErrors(next);
    const first = Object.keys(next)[0];
    if (first) {
      requestAnimationFrame(() => (form.elements.namedItem(first) as HTMLInputElement | null)?.focus());
      return;
    }
    setBusy(true);
    try {
      if (signup) {
        await register({ name, email, password: secret });
        navigate('/login', { replace: true, state: { signupComplete: true } });
      } else {
        await login({ email, password: secret });
      }
    } catch (error) {
      const { message, fields } = authError(error, signup ? 'Unable to create your account. Try again.' : 'Unable to sign in. Try again.');
      const invalidFields: Errors = {};
      for (const field of fields) {
        invalidFields[field] = field === 'email' ? 'Check your email address.' : `Check your ${field}.`;
      }
      setErrors(invalidFields);
      setFormError(message);
    } finally {
      setBusy(false);
    }
  }

  function clearError(field: Field) {
    setErrors(current => ({ ...current, [field]: undefined }));
    setFormError('');
  }

  return (
    <AuthLayout>
      <div className="auth-card">
        <div className="form-icon" aria-hidden="true">{signup ? <UserRound size={23} /> : <LockKeyhole size={23} />}</div>
        <h2 id="auth-title">{signup ? 'Create your account' : 'Welcome back'}</h2>
        <p className="form-intro">{signup ? 'Get started with Nexora.' : 'Sign in to your Nexora workspace.'}</p>
        {signupComplete && <p className="form-success" role="status">Account created. You can now sign in.</p>}
        <form noValidate onSubmit={submit} aria-busy={busy}>
          {signup && <AuthInput name="name" label="Full name" autoComplete="name" required placeholder="Alex Morgan" icon={<UserRound size={17} />} error={errors.name} onChange={() => clearError('name')} />}
          <AuthInput name="email" label="Email address" type="email" autoComplete="email" required placeholder="you@company.com" icon={<Mail size={17} />} error={errors.email} value={email} onChange={event => { setEmail(event.target.value); clearError('email'); }} onClear={() => { setEmail(''); clearError('email'); }} />
          <AuthInput name="password" label="Password" type="password" autoComplete={signup ? 'new-password' : 'current-password'} required placeholder={signup ? 'At least 8 characters' : 'Enter your password'} icon={<LockKeyhole size={17} />} error={errors.password} aria-describedby={signup ? strengthId : undefined} value={password} onChange={event => { setPassword(event.target.value); clearError('password'); }} />
          {signup && <div className="strength" id={strengthId} data-score={score}>
            <div className="strength-bars" aria-hidden="true">{[1, 2, 3, 4].map(level => <i key={level} data-filled={level <= score} />)}</div>
            <span aria-live="polite">{password ? 'Password strength: ' + ['very weak', 'weak', 'fair', 'good', 'strong'][score] : 'Use a mix of letters, numbers, and symbols.'}</span>
          </div>}
          {signup && <AuthInput name="confirmation" label="Confirm password" type="password" autoComplete="new-password" required placeholder="Re-enter your password" icon={<LockKeyhole size={17} />} error={errors.confirmation} onChange={() => clearError('confirmation')} />}
          <div role="alert">{formError && <p className="form-message"><CircleAlert size={17} aria-hidden="true" /> {formError}</p>}</div>
          <AuthButton label={signup ? 'Create account' : 'Sign in'} busy={busy} loadingLabel={signup ? "Creating account..." : "Signing in..."} />
        </form>
        <p className="auth-switch">{signup ? 'Already have an account?' : 'New to Nexora?'} <Link to={signup ? '/login' : '/signup'}>{signup ? 'Sign in' : 'Create an account'}</Link></p>
      </div>
    </AuthLayout>
  );
}
