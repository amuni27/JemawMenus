import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthLayout from '../../components/auth/AuthLayout';
import { Input } from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { useAuth } from '../../app/context/AuthContext';
import * as api from '../../api';

export default function Login() {
  const { login, loading } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const session = await login(email, password);
      if (session.business) nav(`/${session.business.id}/admin/menus`);
      else nav('/');
    } catch (err: any) {
      setError(err.message);
    }
  };
  return (
    <AuthLayout>
      <form onSubmit={submit} className="space-y-6">
        <h1 className="text-2xl font-bold">Welcome back</h1>
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
