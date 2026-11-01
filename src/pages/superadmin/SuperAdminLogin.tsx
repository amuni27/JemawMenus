import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ADMIN_TOKEN_KEY, adminApi } from '../../api/adminApi';
import { errorMessage } from '../../utils/errorMessage';

// AGF E4-M1: Super Admin sign-in. Not linked from public or owner pages; stores only the admin token (SC5).

export default function SuperAdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await adminApi.login(email, password);
      localStorage.setItem(ADMIN_TOKEN_KEY, res.data.token);
      navigate('/super-admin', { replace: true });
    } catch (err) {
      setError(errorMessage(err, "Couldn't sign in. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-5 rounded-2xl bg-white p-6 shadow">
        <h1 className="text-2xl font-bold text-gray-900">Super Admin sign-in</h1>
        {error && <p role="alert" className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        <div>
          <label htmlFor="sa-email" className="mb-1 block text-sm font-medium text-gray-700">Email</label>
          <input id="sa-email" type="email" autoComplete="username" required value={email}
                 onChange={(e) => setEmail(e.target.value)}
                 className="w-full rounded-md border border-gray-300 px-3 py-2" />
        </div>
        <div>
          <label htmlFor="sa-password" className="mb-1 block text-sm font-medium text-gray-700">Password</label>
          <input id="sa-password" type="password" autoComplete="current-password" required value={password}
                 onChange={(e) => setPassword(e.target.value)}
                 className="w-full rounded-md border border-gray-300 px-3 py-2" />
        </div>
        <button type="submit" disabled={busy}
                className="w-full rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-60">
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
