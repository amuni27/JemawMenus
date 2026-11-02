import apiAuth from "../services/apiAuth.ts";

// AGF E4-M4: the owner's plan view and plan requests (own restaurant from the token). A request is never a subscription.
export type OwnerPlan = { code: string; model: string; adSource: "NONE" | "AGAFARI" | "RESTAURANT"; paid: boolean };
export type OwnerSubscription = { planCode: string; status: string; periodEnd: string | null; sourceLabel: string | null; outsideCurrentConfiguration: boolean;
    grandfathering?: OwnerGrandfathering };
// AGF E4-M6: the plan is no longer offered; it stays active until its approved end (dates in the restaurant's time zone)
export type OwnerGrandfathering = { until?: string; daysLeft?: number; transitionsEnabled: boolean; timeZone?: string };
export type OwnerEndedPlan = { planCode: string; endedAt: string; timeZone?: string };
export type OwnerPlanRequest = { id: string; planCode: string; configVersion: number; requestedAt: string; rowVersion: number; outsideCurrentConfiguration: boolean };
export type OwnerPlanView = {
    visible: boolean; setting?: "SETTING_1" | "SETTING_2"; configVersion?: number; plans?: OwnerPlan[]; current?: OwnerSubscription;
    pendingRequest?: OwnerPlanRequest; canRequest?: boolean; trialAvailable?: boolean; featuresUnaffected?: boolean;
    trial?: OwnerTrial; endedPlan?: OwnerEndedPlan;
};
// AGF E4-M5: the restaurant's trial in its effective state (ended as soon as its end date has passed)
export type OwnerTrial = { startedAt: string; endsAt: string; daysLeft: number; effectiveStatus: "TRIAL" | "EXPIRED"; timeZone?: string };

const planApi = {
    get() {
        return apiAuth.get<OwnerPlanView>("/plan");
    },
    request(planCode: string, expectedConfigVersion: number) {
        return apiAuth.post("/plan/requests", { planCode, expectedConfigVersion });
    },
    withdraw(rowVersion: number) {
        return apiAuth.patch("/plan/requests/current", { status: "WITHDRAWN", rowVersion });
    },
};

export default planApi;
