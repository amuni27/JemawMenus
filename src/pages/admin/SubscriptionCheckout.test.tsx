// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

// AGF F3 (register §84 D1, D3, D4, D7): "Subscribe" on a paid plan only while the backend says checkout is available and lists
// the plan's price, for an owner without a plan or on the free plan; never beside "Request" on the same card. It starts a
// checkout with one Idempotency-Key per intent and goes only to Stripe's hosted page; it never activates anything itself.

const get = vi.fn();
vi.mock("../../api/planApi", () => ({ default: { get, request: vi.fn(), withdraw: vi.fn(), activate: vi.fn(), startTrial: vi.fn(), openCardUpdate: vi.fn(),
    notices: vi.fn(() => Promise.resolve({ data: [] })), readNotice: vi.fn() } }));
const create = vi.fn(), getCheckout = vi.fn(), cancel = vi.fn();
vi.mock("../../api/checkoutApi", () => ({ default: { create, get: getCheckout, cancel } }));
const auth = { value: { user: { email: "owner@cafe.test", emailVerification: { verified: true, available: true, publishGateEnabled: false } }, refresh: vi.fn() } };
vi.mock("../../app/context/AuthContext", () => ({ useAuth: () => auth.value }));
const assign = vi.fn();

const { default: SubscriptionPlansPage } = await import("./SubscriptionPlansPage.tsx");

function PlansPage() {
    return (
        <MemoryRouter initialEntries={["/biz-1/admin/plans"]}>
            <Routes><Route path="/:tenantSlug/admin/plans" element={<SubscriptionPlansPage />} /></Routes>
        </MemoryRouter>
    );
}

const plans = [{ code: "MODEL_2", model: "MODEL_2", adSource: "AGAFARI", paid: false }, { code: "MODEL_4", model: "MODEL_4", adSource: "NONE", paid: true }];
const prices = [{ id: "p-month", planCode: "MODEL_4", interval: "MONTH", currency: "USD", amountMinor: 2500 }, { id: "p-year", planCode: "MODEL_4", interval: "YEAR", currency: "USD", amountMinor: 25000 }];
const view = (over: Record<string, unknown> = {}) => ({ data: { visible: true, setting: "SETTING_2", configVersion: 3, plans, canRequest: true, featuresUnaffected: true,
    prices, checkoutAvailable: true, ...over } });
const STRIPE = "https://checkout.stripe.com/c/pay/cs_test_synthetic";
const adFree = async () => (await screen.findAllByRole("article")).find((a) => /Ad-Free/.test(within(a).getByRole("heading").textContent ?? ""))!;
const intent = () => JSON.parse(sessionStorage.getItem("agafari.checkoutIntent") ?? "null");

beforeEach(() => {
    for (const f of [get, create, getCheckout, cancel, assign]) f.mockReset();
    sessionStorage.clear();
    auth.value.user.emailVerification = { verified: true, available: true, publishGateEnabled: false };
    Object.defineProperty(window, "location", { configurable: true, value: { ...window.location, assign } });
    get.mockResolvedValue(view());
});
afterEach(() => cleanup());

describe("Subscribe (F3)", () => {
    it("replaces Request with Subscribe on a paid plan, with a billing-period choice, and keeps Start free", async () => {
        render(<PlansPage />);
        const card = await adFree();
        expect(within(card).getByRole("button", { name: "Subscribe" })).toBeTruthy();
        expect(within(card).queryByRole("button", { name: /^Request/ })).toBeNull();
        const period = within(card).getByRole("group", { name: /Billing period/ });
        expect(within(period).getByRole("radio", { name: "$25.00 per month" })).toHaveProperty("checked", true);
        expect(within(period).getByRole("radio", { name: "$250.00 per year" })).toHaveProperty("checked", false);
        expect(screen.getByText("You'll pay securely on Stripe. Your plan starts once the payment is confirmed.")).toBeTruthy();
        expect(screen.queryByText(/Requesting a plan doesn't charge you/)).toBeNull();
    });

    it("starts a checkout for the chosen price and goes to Stripe's page, keeping the intent for the return page", async () => {
        create.mockResolvedValue({ status: 201, data: { checkoutId: "chk-1", status: "OPEN", redirectUrl: STRIPE, expiresAt: "2026-11-23T00:00:00Z", rowVersion: 0 } });
        render(<PlansPage />);
        const card = await adFree();
        fireEvent.click(within(card).getByRole("radio", { name: "$250.00 per year" }));
        fireEvent.click(within(card).getByRole("button", { name: "Subscribe" }));
        await waitFor(() => expect(assign).toHaveBeenCalledWith(STRIPE));
        const [priceId, key] = create.mock.calls[0];
        expect(priceId).toBe("p-year");
        expect(typeof key).toBe("string");
        expect(intent()).toMatchObject({ priceId: "p-year", planCode: "MODEL_4", idempotencyKey: key, checkoutId: "chk-1" });
    });

    it("reuses the same Idempotency-Key when the owner retries the same choice", async () => {
        create.mockRejectedValueOnce({ response: { status: 502, data: { code: "CHECKOUT_CREATE_FAILED" } } })
            .mockResolvedValueOnce({ status: 200, data: { checkoutId: "chk-1", status: "OPEN", redirectUrl: STRIPE, expiresAt: "x", rowVersion: 0 } });
        render(<PlansPage />);
        const button = within(await adFree()).getByRole("button", { name: "Subscribe" });
        fireEvent.click(button);
        expect((await screen.findByRole("alert")).textContent).toContain("Couldn't start the payment. Please try again.");
        fireEvent.click(button);
        await waitFor(() => expect(assign).toHaveBeenCalled());
        expect(create.mock.calls[1][1]).toBe(create.mock.calls[0][1]);
    });

    it("waits for a checkout that is still being created, then goes to Stripe", async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        create.mockResolvedValue({ status: 202, data: { checkoutId: "chk-2", status: "CREATING", redirectUrl: null, expiresAt: "x", rowVersion: 0 } });
        getCheckout.mockResolvedValueOnce({ data: { checkoutId: "chk-2", status: "CREATING", redirectUrl: null } })
            .mockResolvedValueOnce({ data: { checkoutId: "chk-2", status: "OPEN", redirectUrl: STRIPE } });
        render(<PlansPage />);
        fireEvent.click(within(await adFree()).getByRole("button", { name: "Subscribe" }));
        await vi.advanceTimersByTimeAsync(5000);
        await waitFor(() => expect(assign).toHaveBeenCalledWith(STRIPE));
        vi.useRealTimers();
    });

    it("never follows a link that isn't Stripe's hosted checkout", async () => {
        create.mockResolvedValue({ status: 201, data: { checkoutId: "chk-1", status: "OPEN", redirectUrl: "https://evil.example/pay", expiresAt: "x", rowVersion: 0 } });
        render(<PlansPage />);
        fireEvent.click(within(await adFree()).getByRole("button", { name: "Subscribe" }));
        expect((await screen.findByRole("alert")).textContent).toContain("Couldn't start the payment");
        expect(assign).not.toHaveBeenCalled();
    });

    it("explains each refusal from the backend", async () => {
        render(<PlansPage />);
        const button = within(await adFree()).getByRole("button", { name: "Subscribe" });
        const cases: [unknown, string][] = [
            [{ response: { status: 403, data: { code: "EMAIL_NOT_VERIFIED" } } }, "Verify your email to subscribe to a paid plan."],
            [{ response: { status: 409, data: { code: "PAYMENT_UNDER_REVIEW" } } }, "We're reviewing a payment for your restaurant"],
            [{ response: { status: 409, data: { code: "CHECKOUT_PLAN_CHANGE_UNAVAILABLE" } } }, "To change your plan, contact the Agafari team."],
            [{ response: { status: 409, data: { code: "CHECKOUT_CONVERSION_UNAVAILABLE" } } }, "To change your plan, contact the Agafari team."],
            [{ response: { status: 404 } }, "Online payment isn't available right now."],
            [{ response: { status: 503, data: { code: "CHECKOUT_NOT_CONFIGURED" } } }, "Couldn't start the payment. Please try again."],
        ];
        for (const [err, text] of cases) {
            create.mockRejectedValueOnce(err);
            fireEvent.click(button);
            await waitFor(() => expect(screen.getByRole("alert").textContent).toContain(text));
        }
        expect(assign).not.toHaveBeenCalled();
    });

    it("offers to continue or cancel a payment already in progress (D7)", async () => {
        sessionStorage.setItem("agafari.checkoutIntent", JSON.stringify({ priceId: "p-month", planCode: "MODEL_4", idempotencyKey: "k-old", checkoutId: "chk-old" }));
        create.mockRejectedValue({ response: { status: 409, data: { code: "CHECKOUT_ACTIVE" } } });
        getCheckout.mockResolvedValue({ data: { checkoutId: "chk-old", status: "OPEN", redirectUrl: STRIPE } });
        cancel.mockResolvedValue({ data: { checkoutId: "chk-old", status: "CANCEL_REQUESTED" } });
        render(<PlansPage />);
        const card = await adFree();
        fireEvent.click(within(card).getByRole("radio", { name: "$250.00 per year" }));
        fireEvent.click(within(card).getByRole("button", { name: "Subscribe" }));
        const progress = await screen.findByRole("region", { name: "You have a payment in progress." });
        fireEvent.click(within(progress).getByRole("button", { name: "Continue to payment" }));
        await waitFor(() => expect(assign).toHaveBeenCalledWith(STRIPE));
        expect(getCheckout).toHaveBeenCalledWith("chk-old");
        fireEvent.click(within(screen.getByRole("region", { name: "You have a payment in progress." })).getByRole("button", { name: "Cancel it" }));
        await waitFor(() => expect(cancel).toHaveBeenCalledWith("chk-old"));
        expect(await screen.findByText("Payment cancelled. You weren't charged.")).toBeTruthy();
        expect(intent()).toBeNull();
    });

    it("without a payment this browser started, only says one is in progress", async () => {
        create.mockRejectedValue({ response: { status: 409, data: { code: "CHECKOUT_ACTIVE" } } });
        render(<PlansPage />);
        fireEvent.click(within(await adFree()).getByRole("button", { name: "Subscribe" }));
        const progress = await screen.findByRole("region", { name: "You have a payment in progress." });
        expect(within(progress).queryByRole("button", { name: "Continue to payment" })).toBeNull();
        expect(progress.textContent).toContain("try again later");
    });

    it("keeps Request where checkout isn't available or the plan has no listed price, never both", async () => {
        get.mockResolvedValue(view({ checkoutAvailable: false }));
        render(<PlansPage />);
        let card = await adFree();
        expect(within(card).getByRole("button", { name: "Request Ad-Free" })).toBeTruthy();
        expect(within(card).queryByRole("button", { name: "Subscribe" })).toBeNull();
        expect(screen.getByText(/Requesting a plan doesn't charge you/)).toBeTruthy();
        cleanup();
        get.mockResolvedValue(view({ prices: [] }));
        render(<PlansPage />);
        card = await adFree();
        expect(within(card).queryByRole("button", { name: "Subscribe" })).toBeNull();
        expect(within(card).getByRole("button", { name: "Request Ad-Free" })).toBeTruthy();
    });

    it("offers Subscribe to an owner on the free plan (upgrade), not to one on a paid plan", async () => {
        get.mockResolvedValue(view({ canRequest: false, current: { planCode: "MODEL_2", status: "ACTIVE", periodEnd: null, sourceLabel: null, outsideCurrentConfiguration: false } }));
        render(<PlansPage />);
        expect(within(await adFree()).getByRole("button", { name: "Subscribe" })).toBeTruthy();
        cleanup();
        get.mockResolvedValue(view({ canRequest: false, current: { planCode: "MODEL_4", status: "ACTIVE", periodEnd: "2026-12-20T00:00:00Z", sourceLabel: null, outsideCurrentConfiguration: false, graceUntil: "2026-12-27T00:00:00Z" } }));
        render(<PlansPage />);
        await adFree();
        expect(screen.queryByRole("button", { name: "Subscribe" })).toBeNull();
    });

    it("asks an unverified owner to verify first while verification is operational", async () => {
        auth.value.user.emailVerification = { verified: false, available: true, publishGateEnabled: false };
        render(<PlansPage />);
        const card = await adFree();
        expect((within(card).getByRole("button", { name: "Subscribe" }) as HTMLButtonElement).disabled).toBe(true);
        expect(within(card).getByText("Verify your email to subscribe to a paid plan.")).toBeTruthy();
    });
});
