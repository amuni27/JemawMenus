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

// AGF E4-M2: the platform monetization configuration (Setting 1 = Model 1 only; Setting 2 = Models 2-4, at least one).
export type MonetizationSetting = 'SETTING_1' | 'SETTING_2';
export type MonetizationModel = 'MODEL_1' | 'MODEL_2' | 'MODEL_3' | 'MODEL_4';
export type MonetizationConfig = {
  configured: boolean; version?: number; setting?: MonetizationSetting; models?: MonetizationModel[];
  effectiveFrom?: string; changedAt?: string; changedBy?: string;
};
export type MonetizationConfigChange = { setting: MonetizationSetting; models: MonetizationModel[]; expectedVersion: number };
export type MonetizationHistoryPage = { items: MonetizationConfig[]; page: number; size: number; total: number };

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
  monetizationConfig: () => adminClient.get<MonetizationConfig>('/admin/monetization-config'),
  saveMonetizationConfig: (change: MonetizationConfigChange) => adminClient.put<MonetizationConfig>('/admin/monetization-config', change),
  monetizationHistory: (page: number, size: number) =>
    adminClient.get<MonetizationHistoryPage>('/admin/monetization-config/history', { params: { page, size } }),
};
