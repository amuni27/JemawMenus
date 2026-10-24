import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AuthLayout from '../../components/auth/AuthLayout';
import Button from '../../components/ui/Button';
import { passwordResetApi } from '../../api/passwordResetApi';
import { passwordChecks, isStrongPassword } from '../../utils/passwordPolicy';
import { useFieldErrors } from '../../utils/fieldErrors';

// AGF-S2-13A: opened from the emailed link /auth/reset-password#token=…  The token lives in the URL fragment (never
// sent to a server); it is kept in memory only and removed from the address bar straight away.

const RULES: { key: keyof ReturnType<typeof passwordChecks>; label: string }[] = [
  { key: 'minLength', label: 'At least 8 characters' },
  { key: 'lowercase', label: 'One lowercase letter' },
  { key: 'uppercase', label: 'One uppercase letter' },
  { key: 'number', label: 'One number' },
  { key: 'symbol', label: 'One symbol' },
];

function tokenFrom(hash: string): string {
  const match = /(?:^#|&)token=([^&]+)/.exec(hash);
  return match ? decodeURIComponent(match[1]) : '';
}

export default function ResetPassword() {
  const location = useLocation();
  const navigate = useNavigate();
  const [token] = useState(() => tokenFrom(location.hash));
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [state, setState] = useState<'form' | 'done' | 'invalid'>(() => (tokenFrom(location.hash) ? 'form' : 'invalid'));
  const [error, setError] = useState('');
  const serverErrors = useFieldErrors(); // AGF-S2-11

  // Take the token out of the address bar and history
  useEffect(() => {
    if (location.hash) navigate(location.pathname, { replace: true });
  }, [location.hash, location.pathname, navigate]);

  const checks = passwordChecks(password);
  const mismatch = confirm.length > 0 && confirm !== password;
  const ready = isStrongPassword(password) && confirm === password && !saving;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setSaving(true);
    setError('');
    try {
      await passwordResetApi.reset(token, password);
      setState('done');
    } catch (err) {
      const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code;
      if (code === 'RESET_LINK_INVALID') {
        setState('invalid');
      } else {
        setError(serverErrors.apply(err, { newPassword: password }, "Couldn't change the password. Please try again.") ?? '');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Set a new password</h1>

        {state === 'done' && (
          <div className="space-y-4">
            <p role="status" className="rounded bg-emerald-50 p-3 text-sm text-emerald-800">
              Your password has been changed. Sign in with your new password.
            </p>
            <Link to="/auth/login" className="block w-full rounded-md bg-brand px-4 py-2 text-center text-sm font-medium text-white hover:bg-brand-dark">
              Sign in
            </Link>
          </div>
        )}

        {state === 'invalid' && (
          <div className="space-y-4">
            <p className="rounded bg-amber-50 p-3 text-sm text-amber-800">This reset link is invalid or has expired.</p>
            <p className="text-sm text-gray-600">Links work once and expire after 30 minutes.</p>
            <Link to="/auth/forgot-password" className="block w-full rounded-md bg-brand px-4 py-2 text-center text-sm font-medium text-white hover:bg-brand-dark">
              Request a new link
            </Link>
          </div>
        )}

        {state === 'form' && (
          <form onSubmit={submit} className="space-y-5">
            {error && <p role="alert" className="rounded bg-red-50 p-2 text-sm text-red-600">{error}</p>}
            <div>
              <label htmlFor="reset-password" className="mb-1 block text-sm font-medium text-gray-700">New password</label>
              <input
                id="reset-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-brand-dark focus:outline-none focus:ring-2 focus:ring-brand/50"
              />
              {serverErrors.errorFor('newPassword', password) && (
                <p className="mt-1 text-xs text-red-600">{serverErrors.errorFor('newPassword', password)}</p>
              )}
              <ul className="mt-2 space-y-0.5 text-xs">
                {RULES.map((r) => (
                  <li key={r.key} className={checks[r.key] ? 'text-emerald-700' : 'text-gray-500'}>
                    {checks[r.key] ? '✓' : '•'} {r.label}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <label htmlFor="reset-confirm" className="mb-1 block text-sm font-medium text-gray-700">Confirm new password</label>
              <input
                id="reset-confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-brand-dark focus:outline-none focus:ring-2 focus:ring-brand/50"
              />
              {mismatch && <p className="mt-1 text-xs text-red-600">Passwords don't match</p>}
            </div>
            <Button type="submit" variant="primary" isLoading={saving} disabled={!ready} className="w-full">
              Set new password
            </Button>
          </form>
        )}
      </div>
    </AuthLayout>
  );
}
