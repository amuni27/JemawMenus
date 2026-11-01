import axios from 'axios';

// AGF E4-M1: the Super Admin console's own API client and session (SC5). It uses its own storage key, never sends or
// clears the owner's `token`, and a 401 ends only the admin session. The backend checks the ADMIN role on every request.

export const ADMIN_TOKEN_KEY = 'adminToken';

export type AdminSummary = { id: string; email: string; fullName?: string; role: string };
export type AdminAuditItem = {
  id: string; occurredAt: string; actorLabel: string; action: string; outcome: 'SUCCESS' | 'FAILURE';
  detail: string | null; targetType: string | null; targetId: string | null;
};
export type AdminAuditPage = { items: AdminAuditItem[]; page: number; size: number; total: number };

export const adminClient = axios.create({
  baseURL: `${import.meta.env.VITE_API_BASE_URL ?? 'https://jemaw-menu-backend-spring.onrender.com'}/api`,
});

adminClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

adminClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const url: string = error?.config?.url ?? '';
    if (error?.response?.status === 401 && !url.startsWith('/admin/auth/login')) {
      localStorage.removeItem(ADMIN_TOKEN_KEY);
    }
    return Promise.reject(error);
  }
);

export const adminApi = {
  login: (email: string, password: string) =>
    adminClient.post<{ token: string; admin: AdminSummary }>('/admin/auth/login', { email, password }),
  me: () => adminClient.get<AdminSummary>('/admin/me'),
  auditEvents: (page: number, size: number) => adminClient.get<AdminAuditPage>('/admin/audit-events', { params: { page, size } }),
};
