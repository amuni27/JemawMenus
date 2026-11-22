// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

// AGF F4 (register §84 D1, D5): the pages Stripe returns the owner to. The return page never treats the redirect as payment
// (P-7): it waits, for a bounded time, until the backend's own plan view shows the chosen plan active (from verified evidence).
// The cancel page asks the backend to cancel this browser's checkout. Neither trusts the URL's query.

const get = vi.fn();
vi.mock("../../api/planApi", () => ({ default: { get } }));
const create = vi.fn(), getCheckout = vi.fn(), cancel = vi.fn();
vi.mock("../../api/checkoutApi", () => ({ default: { create, get: getCheckout, cancel } }));
vi.mock("../../app/context/AuthContext", () => ({ useAuth: () => ({ business: { id: "biz-1" } }) }));

const { default: CheckoutReturn } = await import("./CheckoutReturn.tsx");
const { default: CheckoutCancelled } = await import("./CheckoutCancelled.tsx");

const KEY = "agafari.checkoutIntent";
const INTENT = { priceId: "p-month", planCode: "MODEL_4", idempotencyKey: "key-1", checkoutId: "chk-1" };
const storeIntent = (v: unknown = INTENT) => sessionStorage.setItem(KEY, JSON.stringify(v));
const stored = () => sessionStorage.getItem(KEY);
const view = (over: Record<string, unknown> = {}) => ({ data: { visible: true, setting: "SETTING_2", ...over } });
const active = (planCode = "MODEL_4", status = "ACTIVE") => view({ current: { planCode, status, periodEnd: null, sourceLabel: null, outsideCurrentConfiguration: false } });
const refusal = (status: number, code?: string) => Object.assign(new Error("refused"), { response: { status, data: code ? { code } : {} } });

function at(path: string) {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path="/billing/return" element={<CheckoutReturn />} />
                <Route path="/billing/cancelled" element={<CheckoutCancelled />} />
            </Routes>
        </MemoryRouter>,
    );
}

const plansLink = () => screen.getByRole("link", { name: /Subscription & Plans/ });
const tick = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };

beforeEach(() => {
    for (const f of [get, create, getCheckout, cancel]) f.mockReset();
    sessionStorage.clear();
});
afterEach(() => {
    cleanup();
    vi.useRealTimers();
});

describe("Checkout return page (F4)", () => {
    it("shows 'Confirming your payment…' and then 'Your plan is active.' once the backend shows the chosen plan active", async () => {
        storeIntent();
        get.mockResolvedValueOnce(view()).mockResolvedValue(active());
        vi.useFakeTimers();
        at("/billing/return?session=cs_test_synthetic");
        await tick(0);
        expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Confirming your payment…");
        expect(screen.getByRole("status")).toBeTruthy();
        await tick(3000);
        expect(screen.getByText("Your plan is active.")).toBeTruthy();
        expect(plansLink().getAttribute("href")).toBe("/biz-1/admin/plans");
        expect(stored()).toBeNull();
        const calls = get.mock.calls.length;
        await tick(30000);
        expect(get.mock.calls.length).toBe(calls);
    });

    it("never activates or reads the checkout from the redirect: the session query is ignored and nothing is created", async () => {
        storeIntent();
        get.mockResolvedValue(view());
        vi.useFakeTimers();
        at("/billing/return?session=cs_test_paid&status=complete");
        await tick(9000);
        expect(screen.queryByText("Your plan is active.")).toBeNull();
        expect(create).not.toHaveBeenCalled();
        expect(cancel).not.toHaveBeenCalled();
        for (const call of get.mock.calls) expect(call).toEqual([]);
    });

    it("counts only the chosen plan as active (another plan or another status keeps waiting)", async () => {
        storeIntent();
        get.mockResolvedValueOnce(active("MODEL_2")).mockResolvedValueOnce(active("MODEL_4", "PAST_DUE")).mockResolvedValue(active());
        vi.useFakeTimers();
        at("/billing/return");
        await tick(0);
        expect(screen.queryByText("Your plan is active.")).toBeNull();
        await tick(3000);
        expect(screen.queryByText("Your plan is active.")).toBeNull();
        await tick(3000);
        expect(screen.getByText("Your plan is active.")).toBeTruthy();
    });

    it("shows the review message while the backend reviews the payment", async () => {
        storeIntent();
        get.mockResolvedValue(view({ paymentUnderReview: { amountMinor: 2500, currency: "USD", paidAt: null, reference: "r", since: "2026-11-22T00:00:00Z" } }));
        vi.useFakeTimers();
        at("/billing/return");
        await tick(0);
        expect(screen.getByText("We're reviewing your payment. This can take up to two business days.")).toBeTruthy();
        const calls = get.mock.calls.length;
        await tick(9000);
        expect(get.mock.calls.length).toBe(calls);
    });

    it("keeps polling after a failed read, and stops after about 2 minutes with the not-yet message", async () => {
        storeIntent();
        get.mockRejectedValueOnce(refusal(500)).mockResolvedValue(view());
        vi.useFakeTimers();
        at("/billing/return");
        await tick(3000);
        expect(get.mock.calls.length).toBeGreaterThanOrEqual(2);
        expect(screen.queryByText(/We haven't received a confirmation yet/)).toBeNull();
        await tick(120000);
        expect(screen.getByText("We haven't received a confirmation yet. If you paid, it will appear here; you can safely leave this page.")).toBeTruthy();
        const calls = get.mock.calls.length;
        expect(calls).toBeLessThanOrEqual(42);
        await tick(30000);
        expect(get.mock.calls.length).toBe(calls);
        expect(stored()).not.toBeNull();
    });

    it("without a payment started in this browser, says so and doesn't poll", async () => {
        at("/billing/return?session=cs_test_synthetic");
        expect(await screen.findByText("We couldn't find a payment started in this browser. Your plan's state is on Subscription & Plans.")).toBeTruthy();
        expect(get).not.toHaveBeenCalled();
        expect(plansLink().getAttribute("href")).toBe("/biz-1/admin/plans");
    });
});

describe("Checkout cancelled page (F4)", () => {
    it("cancels this browser's checkout and says the owner wasn't charged", async () => {
        storeIntent();
        cancel.mockResolvedValue({ data: { checkoutId: "chk-1", status: "CANCEL_REQUESTED", redirectUrl: null } });
        at("/billing/cancelled");
        expect(await screen.findByText("Payment cancelled. You weren't charged.")).toBeTruthy();
        expect(cancel).toHaveBeenCalledWith("chk-1");
        expect(cancel).toHaveBeenCalledTimes(1);
        expect(stored()).toBeNull();
        expect(plansLink().getAttribute("href")).toBe("/biz-1/admin/plans");
        expect(create).not.toHaveBeenCalled();
    });

    it("an already-cancelled checkout reads the same", async () => {
        storeIntent();
        cancel.mockRejectedValue(refusal(409, "CHECKOUT_CANCELLED"));
        at("/billing/cancelled");
        expect(await screen.findByText("Payment cancelled. You weren't charged.")).toBeTruthy();
        expect(stored()).toBeNull();
    });

    it("a checkout that had already finished points to the plan page instead", async () => {
        storeIntent();
        cancel.mockRejectedValue(refusal(409, "CHECKOUT_NOT_CANCELLABLE"));
        at("/billing/cancelled");
        expect(await screen.findByText("This payment had already finished. Your plan's state is on Subscription & Plans.")).toBeTruthy();
        expect(screen.queryByText(/You weren't charged/)).toBeNull();
        expect(stored()).toBeNull();
    });

    it("if the cancel request fails, it still says not charged and keeps the checkout for 'Cancel it' on the plan page", async () => {
        storeIntent();
        cancel.mockRejectedValue(refusal(502));
        at("/billing/cancelled");
        expect(await screen.findByText("Payment cancelled. You weren't charged.")).toBeTruthy();
        expect(JSON.parse(stored() ?? "null")).toEqual(INTENT);
    });

    it("without a checkout in this browser, cancels nothing", async () => {
        storeIntent({ priceId: "p-month", planCode: "MODEL_4", idempotencyKey: "key-1" });
        at("/billing/cancelled");
        expect(await screen.findByText("We couldn't find a payment started in this browser. Your plan's state is on Subscription & Plans.")).toBeTruthy();
        expect(cancel).not.toHaveBeenCalled();
    });
});
