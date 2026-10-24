import { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthLayout from '../../components/auth/AuthLayout';
import Button from '../../components/ui/Button';
import { passwordResetApi } from '../../api/passwordResetApi';
import { errorMessage } from '../../utils/errorMessage';

// AGF-S2-13A: the confirmation is the same whether or not the email has an account (no enumeration)
const SENT_MESSAGE =
  "If an account exists for that email, we've sent a link to reset the password. The link expires in 30 minutes.";

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError('');
    try {
      await passwordResetApi.request(email.trim());
      setSent(true);
    } catch (err) {
      setError(errorMessage(err, "Couldn't send the request. Please try again."));
    } finally {
      setSending(false);
    }
  };

  return (
    <AuthLayout>
      <form onSubmit={submit} className="space-y-6">
        <h1 className="text-2xl font-bold">Reset your password</h1>
        {sent ? (
          <p role="status" className="rounded bg-emerald-50 p-3 text-sm text-emerald-800">{SENT_MESSAGE}</p>
        ) : (
          <>
            <p className="text-sm text-gray-600">Enter the email you sign in with and we'll send you a link to set a new password.</p>
            {error && <p role="alert" className="rounded bg-red-50 p-2 text-sm text-red-600">{error}</p>}
            <div>
              <label htmlFor="forgot-email" className="mb-1 block text-sm font-medium text-gray-700">Email</label>
              <input
                id="forgot-email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-brand-dark focus:outline-none focus:ring-2 focus:ring-brand/50"
              />
            </div>
            <Button type="submit" variant="primary" isLoading={sending} disabled={sending || !email.trim()} className="w-full">
              Send reset link
            </Button>
          </>
        )}
        <p className="text-center text-sm">
          <Link className="text-rose-500 hover:underline" to="/auth/login">Back to sign in</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
