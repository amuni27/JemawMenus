import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthLayout from '../../components/auth/AuthLayout';
import { Input } from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { useAuth } from '../../app/context/AuthContext';
import * as api from '../../api';

export default function Register() {
  const { register, loading } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | undefined>();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const sess = await register(email, password, name, address, phone);
      const tenant = await api.tenant.getTenantById(sess.tenantId);
      if (tenant) nav(`/${tenant.slug}/admin`);
      else nav('/');
    } catch (err: any) {
      setError(err.message);
    }
  };
  return (
    <AuthLayout>
      <form onSubmit={submit} className="space-y-6">
        <h1 className="text-2xl font-bold">Create your account</h1>
        {error && <p className="rounded bg-red-50 p-2 text-sm text-red-600">{error}</p>}
        <Input
          label="Restaurant name"
          placeholder="My Bistro"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input
          label="Address"
          placeholder="123 Main St, City"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          required
        />
        <Input
          label="Phone"
          placeholder="+1 555 123 4567"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        />
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
          {loading ? 'Creating account…' : 'Sign up'}
        </Button>
        <p className="text-center text-sm">
          Already have an account?{' '}
          <a className="text-rose-500 hover:underline" href="/auth/login">
            Log in
          </a>
        </p>
      </form>
    </AuthLayout>
  );
}
