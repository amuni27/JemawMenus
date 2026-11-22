import apiAuth from "../services/apiAuth.ts";

// AGF E4-M4: the owner's plan view and plan requests (own restaurant from the token). A request is never a subscription.
export type OwnerPlan = { code: string; model: string; adSource: "NONE" | "AGAFARI" | "RESTAURANT"; paid: boolean };
export type OwnerSubscription = { planCode: string; status: string; periodEnd: string | null; sourceLabel: string | null; outsideCurrentConfiguration: boolean;
    grandfathering?: OwnerGrandfathering;
    // AGF FE-R1 (backend R5-03-B): a paid (provider-billed) plan only: the grace end (period end + 7 days) and, while past due, since when
    graceUntil?: string; pastDueSince?: string };
// AGF FE-R1 (backend R5-03-B): a paid plan's renewal needing the owner's attention; dates in the restaurant's time zone
export type OwnerRenewal = { state: "PAST_DUE" | "ENDED_PAYMENT_FAILED" | "REFUND_PENDING"; periodEnd?: string; graceUntil?: string; endedAt?: string;
    refund?: OwnerRefundPending; timeZone?: string };
// AGF FE-R2 (backend R5-03-D): one delivered in-app notice of the owner's restaurant; `data` holds plan, dates, amounts, time zone
export type OwnerNotice = { id: string; kind: string; read: boolean; createdAt: string; data: OwnerNoticeData };
export type OwnerNoticeData = { planCode?: string; periodEnd?: string; graceUntil?: string; endedAt?: string; day?: number; amountMinor?: number; currency?: string;
    timeZone?: string };
export type OwnerRefundPending = { amountMinor: number | null; currency: string | null; reason: "PAID_AFTER_EXPIRY" | "RENEWAL_DUPLICATE_PERIOD" };
// AGF E4-M6: the plan is no longer offered; it stays active until its approved end (dates in the restaurant's time zone)
export type OwnerGrandfathering = { until?: string; daysLeft?: number; transitionsEnabled: boolean; timeZone?: string };
export type OwnerEndedPlan = { planCode: string; endedAt: string; timeZone?: string };
export type OwnerPlanRequest = { id: string; planCode: string; configVersion: number; requestedAt: string; rowVersion: number; outsideCurrentConfiguration: boolean };
export type OwnerPlanView = {
    visible: boolean; setting?: "SETTING_1" | "SETTING_2"; configVersion?: number; plans?: OwnerPlan[]; current?: OwnerSubscription;
    pendingRequest?: OwnerPlanRequest; canRequest?: boolean; trialAvailable?: boolean; featuresUnaffected?: boolean;
    trial?: OwnerTrial; endedPlan?: OwnerEndedPlan;
    // AGF Self-Service Phase A: present only while self-service is on
    selfService?: { available: boolean; verificationRequired: boolean };
    // AGF R5 F1 (backend SUB-R3-02): present only while prices are visible in the restaurant's market; `id` is what a checkout names
    prices?: OwnerPrice[];
    // AGF R5 F1 (backend SUB-R4-11): present only while a payment for this restaurant is being reviewed (no plan change until resolved)
    paymentUnderReview?: OwnerPaymentUnderReview;
    // AGF FE-1 (backend BE-1): present only while trials are enabled; true when the owner can start the free trial now
    trialEligible?: boolean;
    // AGF FE-2 (backend BE-5a): present only while the cut-over is configured; true when this new restaurant must still choose how to start
    selectionRequired?: boolean;
    // AGF FE-3 (backend BE-5b): present only while the publish gate is on for the restaurant's market; the gate's own decision
    publishAllowed?: boolean;
    // AGF FE-R1 (backend R5-03-B): present only while a paid plan's renewal needs the owner's attention
    renewal?: OwnerRenewal;
};
// AGF FE-1: the backend's SubscriptionActivationResponse for POST /plan/trial (201 created; 200 the trial already running)
export type OwnerTrialStart = { subscriptionId: string; planCode: string; status: string; created: boolean; withdrawnRequestId: string | null };
// AGF R5 F1: mirrors the backend's OwnerPlanView.Price (amounts in minor units, e.g. cents)
export type OwnerPrice = { id: string; planCode: string; interval: "MONTH" | "YEAR"; currency: "USD" | "ETB"; amountMinor: number };
// AGF R5 F1: mirrors the backend's OwnerPlanView.PaymentUnderReview; the backend may send null for the amount, currency or payment time
export type OwnerPaymentUnderReview = { amountMinor: number | null; currency: string | null; paidAt: string | null; reference: string; since: string };
// AGF E4-M5: the restaurant's trial in its effective state (ended as soon as its end date has passed)
export type OwnerTrial = { startedAt: string; endsAt: string; daysLeft: number; effectiveStatus: "TRIAL" | "EXPIRED"; timeZone?: string };

const planApi = {
    get() {
        return apiAuth.get<OwnerPlanView>("/plan");
    },
    request(planCode: string, expectedConfigVersion: number) {
        return apiAuth.post("/plan/requests", { planCode, expectedConfigVersion });
    },
    // AGF Self-Service Phase A: start a free plan; a pending request is withdrawn only when named here (explicit confirmation)
    activate(planCode: string, expectedConfigVersion: number, withdrawPending?: { id: string; rowVersion: number }) {
        return apiAuth.post("/plan/activations", { planCode, expectedConfigVersion,
            ...(withdrawPending ? { withdrawPendingRequestId: withdrawPending.id, withdrawPendingRequestRowVersion: withdrawPending.rowVersion } : {}) });
    },
    // AGF FE-1: the owner starts the restaurant's free trial (Setting 1); the restaurant and owner come from the token
    startTrial(expectedConfigVersion: number) {
        return apiAuth.post<OwnerTrialStart>("/plan/trial", { expectedConfigVersion });
    },
    // AGF FE-R1 (backend R5-03-E): a short-lived link to the payment provider's hosted card-update page for the owner's own plan
    openCardUpdate() {
        return apiAuth.post<{ url: string }>("/billing/subscription/portal-session");
    },
    // AGF FE-R2 (backend R5-03-D): the owner's delivered notices, newest first; marking one read is idempotent
    notices() {
        return apiAuth.get<OwnerNotice[]>("/plan/notices");
    },
    readNotice(id: string) {
        return apiAuth.post(`/plan/notices/${encodeURIComponent(id)}/read`);
    },
    withdraw(rowVersion: number) {
        return apiAuth.patch("/plan/requests/current", { status: "WITHDRAWN", rowVersion });
    },
};

export default planApi;
