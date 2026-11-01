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

// AGF E4-M3: plans, a read-only restaurant list and manual subscription records (no payment verified).
export type SubscriptionPlan = { code: MonetizationModel; model: MonetizationModel; setting: MonetizationSetting;
  adSource: 'NONE' | 'AGAFARI' | 'RESTAURANT'; paid: boolean; enabledByCurrentConfiguration: boolean };
export type AdminBusiness = { id: string; name: string; slug: string; createdAt: string; subscriptionStatus: string | null; planCode: string | null };
export type AdminBusinessPage = { items: AdminBusiness[]; page: number; size: number; total: number };
export type Subscription = {
  id: string; businessId: string; planCode: MonetizationModel; status: 'TRIAL' | 'ACTIVE' | 'GRANDFATHERED' | 'EXPIRED';
  configVersion: number; periodEnd: string | null; transitionDate: string | null; source: 'MANUAL' | 'PROVIDER';
  paymentVerified: boolean; sourceLabel: string | null; createdAt: string; createdBy: string; updatedAt: string;
  endedAt: string | null; rowVersion: number; outsideCurrentConfiguration: boolean;
};
export type Entitlements = { mode: 'INACTIVE' | 'ACTIVE'; planCode: string | null; status: string | null;
  adSource: 'NONE' | 'AGAFARI' | 'RESTAURANT'; restaurantAdManager: boolean; limits: Record<string, number>; source: string | null; degraded: boolean };
export type PlanRequestSummary = { id: string; planCode: MonetizationModel; configVersion: number; requestedAt: string;
  rowVersion: number; outsideCurrentConfiguration: boolean };
export type BusinessSubscriptionView = { businessId: string; businessName: string; current?: Subscription;
  entitlements: Entitlements; monetizationActive: boolean; pendingRequest?: PlanRequestSummary };
// AGF E4-M4: owner plan requests; fulfilling records the E4-M3 manual subscription (no payment verified).
export type PlanRequest = { id: string; businessId: string; businessName?: string; planCode: MonetizationModel; configVersion: number;
  status: 'PENDING' | 'FULFILLED' | 'DECLINED' | 'WITHDRAWN'; requestedAt: string; requestedBy?: string; resolvedAt?: string;
  subscriptionId?: string; rowVersion: number; outsideCurrentConfiguration: boolean };
export type PlanRequestPage = { items: PlanRequest[]; page: number; size: number; total: number };
export type SubscriptionRecord = { planCode: MonetizationModel; periodEnd?: string; expectedConfigVersion: number };

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
  plans: () => adminClient.get<SubscriptionPlan[]>('/admin/plans'),
  businesses: (query: string, page: number, size: number) =>
    adminClient.get<AdminBusinessPage>('/admin/businesses', { params: { query, page, size } }),
  businessSubscription: (businessId: string) => adminClient.get<BusinessSubscriptionView>(`/admin/businesses/${businessId}/subscription`),
  subscriptionHistory: (businessId: string) => adminClient.get<Subscription[]>(`/admin/businesses/${businessId}/subscriptions`),
  recordSubscription: (businessId: string, record: SubscriptionRecord) =>
    adminClient.post<Subscription>(`/admin/businesses/${businessId}/subscription`, record),
  endSubscription: (businessId: string, rowVersion: number) =>
    adminClient.patch<Subscription>(`/admin/businesses/${businessId}/subscription`, { status: 'EXPIRED', rowVersion }),
  planRequests: (status: string, page: number, size: number) =>
    adminClient.get<PlanRequestPage>('/admin/plan-requests', { params: { status, page, size } }),
  fulfilPlanRequest: (id: string, expectedConfigVersion: number, rowVersion: number) =>
    adminClient.post<PlanRequest>(`/admin/plan-requests/${id}/fulfil`, { expectedConfigVersion, rowVersion }),
  declinePlanRequest: (id: string, rowVersion: number) =>
    adminClient.post<PlanRequest>(`/admin/plan-requests/${id}/decline`, { rowVersion }),
};
