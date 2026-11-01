import { useState } from 'react';
import { MailWarning } from 'lucide-react';
import { useAuth } from '../../app/context/AuthContext';
import { emailVerificationApi } from '../../api/emailVerificationApi';
import { errorMessage } from '../../utils/errorMessage';

// AGF-S2-22: shown in the owner area only while verification is available and the email isn't verified. It mentions
// publishing only when the publish gate is on, so it never claims a restriction that isn't enforced. Resend shows the
// server's own answer (sent, couldn't send, too many attempts).

export default function EmailVerificationBanner() {
  const { user, refresh } = useAuth();
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const state = user?.emailVerification;
  if (!state || state.verified || !state.available) return null;

  const resend = async () => {
    setSending(true);
    setResult(null);
    try {
      const res = await emailVerificationApi.resend();
      setResult({ ok: true, text: res.data?.message ?? 'We sent a new link.' });
      if (res.status === 200) await refresh?.(); // already verified: update the session so the banner goes away
    } catch (err) {
      setResult({ ok: false, text: errorMessage(err, "We couldn't send the email right now. Please try again in a few minutes.") });
    } finally {
      setSending(false);
    }
  };

  return (
    <div role="status" className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2">
          <MailWarning aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {state.publishGateEnabled ? 'Verify your email to publish menus.' : 'Please verify your email address.'}{' '}
            We sent a link to {user?.email}.
          </span>
        </p>
        <button
          type="button"
          onClick={resend}
          disabled={sending}
          className="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-1.5 font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-60"
        >
          {sending ? 'Sending…' : 'Resend link'}
        </button>
      </div>
      {result && (
        <p className={`mt-2 ${result.ok ? 'text-amber-900' : 'font-medium text-red-700'}`}>{result.text}</p>
      )}
    </div>
  );
}
