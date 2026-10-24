import apiAuth from '../services/apiAuth';

// AGF-S2-13A: password reset by email link (public endpoints)
export const passwordResetApi = {
  request: (email: string) => apiAuth.post('/auth/forgot-password', { email }),
  reset: (token: string, newPassword: string) => apiAuth.post('/auth/reset-password', { token, newPassword }),
};
