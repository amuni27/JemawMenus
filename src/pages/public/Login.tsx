import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AuthLayout from '../../components/auth/AuthLayout';
import { Input } from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { useAuth } from '../../app/context/AuthContext';
import { safeNextPath } from '../../services/session';

// Why the owner was sent here (AGF-S1-11)
const REASON_MESSAGES: Record<string, string> = {
  expired: 'Your session expired, please sign in again.',
  inactive: 'Your account is not active. Contact support.',
};

export default function Login() {
  const { login, loading } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const reasonMessage = REASON_MESSAGES[params.get('reason') ?? ''];
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const session = await login(email, password);
      const businessId = session.business?.id;
      // Return to the page the owner was on, if it is one of their own admin pages
      const next = safeNextPath(params.get('next'), businessId);
      if (businessId) nav(next ?? `/${businessId}/admin/menus`, { replace: true });
      else nav('/');
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Sign in failed. Please try again.";
      setError(msg);
    }
  };
  return (
    <AuthLayout>
      <form onSubmit={submit} className="space-y-6">
        <h1 className="text-2xl font-bold">Welcome back</h1>
        {reasonMessage && !error && (
          <p role="status" className="rounded bg-amber-50 p-2 text-sm text-amber-800">{reasonMessage}</p>
        )}
        {error && <p className="rounded bg-red-50 p-2 text-sm text-red-600">{error}</p>}
        <Input
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          label="Password"
          type="password"
          placeholder="********"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {/* AGF-S2-13A */}
        <p className="-mt-3 text-right text-sm">
          <Link className="text-rose-500 hover:underline" to="/auth/forgot-password">Forgot password?</Link>
        </p>
        <Button type="submit" variant="primary" isLoading={loading} className="w-full">
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
        <p className="text-center text-sm">
          Don’t have an account?{' '}
          <a className="text-rose-500 hover:underline" href="/auth/register">
            Sign up
          </a>
        </p>
      </form>
    </AuthLayout>
  );
}
