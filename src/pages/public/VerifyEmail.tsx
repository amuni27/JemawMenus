import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AuthLayout from '../../components/auth/AuthLayout';
import { emailVerificationApi } from '../../api/emailVerificationApi';
import { useAuth } from '../../app/context/AuthContext';

// AGF-S2-22: opened from the emailed link /auth/verify-email#token=…  The token lives in the URL fragment (never sent
// to a server), is submitted once and removed from the address bar straight away (as the S2-13A reset page).

type State = 'verifying' | 'verified' | 'already' | 'invalid' | 'unavailable' | 'error';

function tokenFrom(hash: string): string {
  const match = /(?:^#|&)token=([^&]+)/.exec(hash);
  return match ? decodeURIComponent(match[1]) : '';
}

export default function VerifyEmail() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, business, refresh } = useAuth();
  const [token] = useState(() => tokenFrom(location.hash));
  const [state, setState] = useState<State>(() => (token ? 'verifying' : 'invalid'));
  const submitted = useRef(false);

  // Take the token out of the address bar and history
  useEffect(() => {
    if (location.hash) navigate(location.pathname, { replace: true });
  }, [location.hash, location.pathname, navigate]);

  useEffect(() => {
    if (!token || submitted.current) return;
    submitted.current = true;
    emailVerificationApi.verify(token).then(
      async (res) => {
        setState(res.data?.status === 'ALREADY_VERIFIED' ? 'already' : 'verified');
        if (user) await refresh?.(); // a signed-in owner's banner goes away
      },
      (err) => {
        const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code;
        setState(code === 'VERIFY_LINK_INVALID' ? 'invalid' : code === 'EMAIL_VERIFICATION_UNAVAILABLE' ? 'unavailable' : 'error');
      }
    );
  }, [token, user, refresh]);

  // A signed-in owner goes back to their menus; /auth/login doesn't redirect signed-in users. brand-dark keeps AA contrast.
  const signIn = (
    <Link
      to={user && business?.id ? `/${business.id}/admin/menus` : '/auth/login'}
      className="block w-full rounded-md bg-brand-dark px-4 py-2 text-center text-sm font-medium text-white hover:bg-rose-700"
    >
      {user && business?.id ? 'Go to your menus' : 'Sign in'}
    </Link>
  );

  return (
    <AuthLayout>
      <div className="space-y-6">
        {state === 'verifying' && <h1 className="text-2xl font-bold">Verifying your email…</h1>}
        {(state === 'verified' || state === 'already') && (
          <>
            <h1 className="text-2xl font-bold">{state === 'verified' ? 'Email verified' : 'Email already verified'}</h1>
            <p role="status" className="rounded bg-emerald-50 p-3 text-sm text-emerald-800">
              {state === 'verified' ? 'Thanks! Your email address is confirmed.' : 'Your email address was already confirmed.'}
            </p>
            {signIn}
          </>
        )}
        {state === 'invalid' && (
          <>
            <h1 className="text-2xl font-bold">Verify your email</h1>
            <p className="rounded bg-amber-50 p-3 text-sm text-amber-800">This verification link has expired or is invalid.</p>
            <p className="text-sm text-gray-600">Links expire after 24 hours. {user ? 'Choose "Resend link" in your restaurant area to get a new one.' : 'Sign in and choose "Resend link" to get a new one.'}</p>
            {signIn}
          </>
        )}
        {(state === 'unavailable' || state === 'error') && (
          <>
            <h1 className="text-2xl font-bold">Verify your email</h1>
            <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700">
              {state === 'unavailable'
                ? "Email verification isn't available right now. Please try again later."
                : "We couldn't verify your email right now. Please try the link again in a few minutes."}
            </p>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
