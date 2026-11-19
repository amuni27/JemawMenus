// @vitest-environment jsdom
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import type { OwnerPaymentUnderReview, OwnerPlanView, OwnerPrice, OwnerTrialStart } from "./planApi.ts";

// AGF E4-M4: the owner's plan API goes through the owner client (owner token); the restaurant comes from the token.

const get = vi.fn().mockResolvedValue({ data: {} });
const post = vi.fn().mockResolvedValue({ data: {} });
const patch = vi.fn().mockResolvedValue({ data: {} });
vi.mock("../services/apiAuth.ts", () => ({ default: { get, post, patch } }));

const { default: planApi } = await import("./planApi.ts");

describe("owner plan API", () => {
    it("reads the plan view, requests a plan and withdraws the pending request", async () => {
        await planApi.get();
        await planApi.request("MODEL_4", 3);
        await planApi.withdraw(2);
        expect(get).toHaveBeenCalledWith("/plan");
        expect(post).toHaveBeenCalledWith("/plan/requests", { planCode: "MODEL_4", expectedConfigVersion: 3 });
        expect(patch).toHaveBeenCalledWith("/plan/requests/current", { status: "WITHDRAWN", rowVersion: 2 });
    });

    // AGF R5 F1: the plan view's optional price and payment-review fields, exactly as the backend's OwnerPlanView sends them
    // (`prices` only while prices are visible in the restaurant's market; `paymentUnderReview` only while a payment is reviewed).
    it("passes prices and a payment under review through unchanged", async () => {
        const view: OwnerPlanView = {
            visible: true, setting: "SETTING_2", configVersion: 4,
            plans: [{ code: "MODEL_4", model: "MODEL_4", adSource: "NONE", paid: true }],
            prices: [{ id: "8e1f6a40-0000-4000-8000-000000000001", planCode: "MODEL_4", interval: "MONTH", currency: "USD", amountMinor: 2500 }],
            paymentUnderReview: { amountMinor: 2500, currency: "USD", paidAt: "2026-11-11T11:57:47Z", reference: "exc-1", since: "2026-11-11T11:58:00Z" },
        };
        get.mockResolvedValueOnce({ data: view });
        const res = await planApi.get();
        expect(res.data).toEqual(view);
        expect(res.data.prices?.[0].amountMinor).toBe(2500);
        expect(res.data.paymentUnderReview?.reference).toBe("exc-1");
    });

    it("keeps the fields optional and the review values nullable, as the backend omits or nulls them", async () => {
        const hidden: OwnerPlanView = { visible: false };
        get.mockResolvedValueOnce({ data: hidden });
        const res = await planApi.get();
        expect(res.data.prices).toBeUndefined();
        expect(res.data.paymentUnderReview).toBeUndefined();
        const unknownAmount: OwnerPaymentUnderReview = { amountMinor: null, currency: null, paidAt: null, reference: "exc-2", since: "2026-11-11T12:00:00Z" };
        expect(unknownAmount.amountMinor).toBeNull();
    });

    it("types match the backend DTO (OwnerPlanView.Price, OwnerPlanView.PaymentUnderReview)", () => {
        expectTypeOf<OwnerPlanView["prices"]>().toEqualTypeOf<OwnerPrice[] | undefined>();
        expectTypeOf<OwnerPlanView["paymentUnderReview"]>().toEqualTypeOf<OwnerPaymentUnderReview | undefined>();
        expectTypeOf<OwnerPrice>().toEqualTypeOf<{ id: string; planCode: string; interval: "MONTH" | "YEAR"; currency: "USD" | "ETB"; amountMinor: number }>();
        expectTypeOf<OwnerPaymentUnderReview>().toEqualTypeOf<{ amountMinor: number | null; currency: string | null; paidAt: string | null; reference: string; since: string }>();
    });

    // AGF FE-1 (backend BE-1): the owner starts the restaurant's free trial; only the configuration version is sent (the
    // restaurant and owner come from the token). The response is the backend's SubscriptionActivationResponse.
    it("starts the free trial with the configuration version the owner saw", async () => {
        post.mockResolvedValueOnce({ status: 201, data: { subscriptionId: "t1", planCode: "MODEL_1", status: "TRIAL", created: true, withdrawnRequestId: null } });
        const res = await planApi.startTrial(1);
        expect(post).toHaveBeenLastCalledWith("/plan/trial", { expectedConfigVersion: 1 });
        expect(res.data.created).toBe(true);
    });

    it("types trialEligible and the trial start response as the backend sends them", () => {
        expectTypeOf<OwnerPlanView["trialEligible"]>().toEqualTypeOf<boolean | undefined>();
        expectTypeOf<OwnerTrialStart>().toEqualTypeOf<{ subscriptionId: string; planCode: string; status: string; created: boolean; withdrawnRequestId: string | null }>();
    });
});
