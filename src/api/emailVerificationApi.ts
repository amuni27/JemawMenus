import apiAuth from '../services/apiAuth';

// AGF-S2-22: email verification (verify is public; resend needs the signed-in owner)
export const emailVerificationApi = {
  verify: (token: string) => apiAuth.post<{ status: 'VERIFIED' | 'ALREADY_VERIFIED'; message?: string }>('/auth/verify-email', { token }),
  resend: () => apiAuth.post<{ message?: string }>('/auth/verify-email/resend'),
};
