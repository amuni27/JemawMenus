// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

// AGF FE-R1 (assessment story 6; backend R5-03-B/E; addendum §13 "Owner sees"): the owner sees a PROVIDER plan's renewal
// state on Subscription & Plans: past due with the date to update the card by and an "Update card" action (the provider's
// hosted page), ended for non-payment, a refund in progress, and a payment under review. Dates in the restaurant's time zone.

const get = vi.fn();
const openCardUpdate = vi.fn();
vi.mock("../../api/planApi", () => ({ default: { get, request: vi.fn(), withdraw: vi.fn(), activate: vi.fn(), startTrial: vi.fn(), openCardUpdate,
    notices: vi.fn(() => Promise.resolve({ data: [] })) } })); // AGF FE-R2: no notices
const auth = { value: { user: { email: "owner@cafe.test", emailVerification: { verified: true, available: true, publishGateEnabled: false } }, refresh: vi.fn() } };
vi.mock("../../app/context/AuthContext", () => ({ useAuth: () => auth.value }));
const assign = vi.fn();

const { default: SubscriptionPlansPage } = await import("./SubscriptionPlansPage.tsx");

function PlansPage() {
    return (
        <MemoryRouter initialEntries={["/biz-1/admin/plans"]}>
            <Routes>
                <Route path="/:tenantSlug/admin/plans" element={<SubscriptionPlansPage />} />
                <Route path="/:tenantSlug/admin" element={<p>Dashboard page</p>} />
            </Routes>
        </MemoryRouter>
    );
}

const ZONE = "Africa/Addis_Ababa"; // UTC+3
const providerPlan = (over: Record<string, unknown> = {}) => ({ planCode: "MODEL_4", status: "ACTIVE", periodEnd: "2026-12-20T15:18:24Z", sourceLabel: null,
    outsideCurrentConfiguration: false, graceUntil: "2026-12-27T15:18:24Z", ...over });
const view = (over: Record<string, unknown> = {}) => ({ data: { visible: true, setting: "SETTING_2", configVersion: 3, plans: [], canRequest: false, featuresUnaffected: true, ...over } });
const fmt = (iso: string) => new Intl.DateTimeFormat(undefined, { timeZone: ZONE, year: "numeric", month: "numeric", day: "numeric" }).format(new Date(Date.parse(iso) - 1));

beforeEach(() => {
    get.mockReset();
    openCardUpdate.mockReset();
    assign.mockReset();
    Object.defineProperty(window, "location", { configurable: true, value: { ...window.location, assign } });
});
afterEach(() => cleanup());

describe("owner renewal states", () => {
    it("shows a past-due plan with its update-by date in the restaurant's time zone and an Update card action", async () => {
        // 22:30 UTC is already the next day in Addis Ababa (UTC+3): the date must be the restaurant's, not the browser's
        get.mockResolvedValue(view({ current: providerPlan({ status: "PAST_DUE", pastDueSince: "2026-12-20T22:30:00Z", graceUntil: "2026-12-27T22:30:00Z" }),
            renewal: { state: "PAST_DUE", periodEnd: "2026-12-20T22:30:00Z", graceUntil: "2026-12-27T22:30:00Z", timeZone: ZONE } }));
        render(<PlansPage />);
        const notice = await screen.findByRole("region", { name: "Payment failed" });
        expect(notice.textContent).toContain(`Update your card by ${fmt("2026-12-27T22:30:00Z")}`);
        expect(fmt("2026-12-27T22:30:00Z")).not.toBe(new Intl.DateTimeFormat(undefined, { timeZone: "UTC", year: "numeric", month: "numeric", day: "numeric" })
            .format(new Date(Date.parse("2026-12-27T22:30:00Z") - 1)));
        expect(within(notice).getByRole("button", { name: "Update card" })).toBeTruthy();
        const currentPlan = screen.getByRole("region", { name: "Current plan" });
        expect(currentPlan.textContent).toContain("· Past due"); // a human label, never "Past_due"
        expect(currentPlan.textContent).not.toContain("Past_due");
    });

    it("opens the provider's card-update page", async () => {
        get.mockResolvedValue(view({ current: providerPlan({ status: "PAST_DUE" }), renewal: { state: "PAST_DUE", graceUntil: "2026-12-27T15:18:24Z", timeZone: ZONE } }));
        openCardUpdate.mockResolvedValue({ data: { url: "https://billing.stripe.com/p/session/test_synthetic" } });
        render(<PlansPage />);
        fireEvent.click(await screen.findByRole("button", { name: "Update card" }));
        await waitFor(() => expect(assign).toHaveBeenCalledWith("https://billing.stripe.com/p/session/test_synthetic"));
        expect(openCardUpdate).toHaveBeenCalledTimes(1);
    });

    it("never follows anything but an https URL", async () => {
        get.mockResolvedValue(view({ current: providerPlan({ status: "PAST_DUE" }), renewal: { state: "PAST_DUE", graceUntil: "2026-12-27T15:18:24Z", timeZone: ZONE } }));
        openCardUpdate.mockResolvedValue({ data: { url: "javascript:alert(1)" } });
        render(<PlansPage />);
        fireEvent.click(await screen.findByRole("button", { name: "Update card" }));
        expect(await screen.findByRole("alert")).toBeTruthy();
        expect(assign).not.toHaveBeenCalled();
    });

    it("explains when the card-update page can't be opened", async () => {
        get.mockResolvedValue(view({ current: providerPlan({ status: "PAST_DUE" }), renewal: { state: "PAST_DUE", graceUntil: "2026-12-27T15:18:24Z", timeZone: ZONE } }));
        openCardUpdate.mockRejectedValueOnce({ response: { status: 503, data: { code: "PORTAL_UNAVAILABLE" } } });
        render(<PlansPage />);
        fireEvent.click(await screen.findByRole("button", { name: "Update card" }));
        expect((await screen.findByRole("alert")).textContent).toContain("unavailable right now");
        openCardUpdate.mockRejectedValueOnce({ response: { status: 409, data: { code: "PORTAL_NOT_ELIGIBLE" } } });
        fireEvent.click(screen.getByRole("button", { name: "Update card" }));
        await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("isn't available for this plan"));
        expect(assign).not.toHaveBeenCalled();
    });

    it("offers Update card for an active paid plan, but no renewal notice", async () => {
        get.mockResolvedValue(view({ current: providerPlan() }));
        render(<PlansPage />);
        expect(await screen.findByRole("button", { name: "Update card" })).toBeTruthy();
        expect(screen.queryByRole("region", { name: "Payment failed" })).toBeNull();
    });

    it("shows a plan ended for non-payment, with the refund when one is pending", async () => {
        get.mockResolvedValue(view({ renewal: { state: "ENDED_PAYMENT_FAILED", endedAt: "2026-12-27T15:18:24Z", timeZone: ZONE,
            refund: { amountMinor: 2500, currency: "USD", reason: "PAID_AFTER_EXPIRY" } } }));
        render(<PlansPage />);
        const notice = await screen.findByRole("region", { name: "Your plan ended" });
        expect(notice.textContent).toContain(`ended on ${fmt("2026-12-27T15:18:24Z")}`);
        expect(notice.textContent).toContain("$25.00");
        expect(notice.textContent).toContain("will be refunded");
        expect(screen.queryByRole("button", { name: "Update card" })).toBeNull();
    });

    it("shows a duplicate payment that will be refunded on an active plan", async () => {
        get.mockResolvedValue(view({ current: providerPlan(), renewal: { state: "REFUND_PENDING", timeZone: ZONE,
            refund: { amountMinor: 250000, currency: "ETB", reason: "RENEWAL_DUPLICATE_PERIOD" } } }));
        render(<PlansPage />);
        const notice = await screen.findByRole("region", { name: "Refund in progress" });
        expect(notice.textContent).toContain("duplicate payment");
        expect(notice.textContent).toMatch(/2,500\.00/);
    });

    it("shows a payment under review once, and not alongside a refund notice", async () => {
        get.mockResolvedValue(view({ current: providerPlan(), paymentUnderReview: { amountMinor: 2500, currency: "USD", paidAt: "2026-12-21T10:00:00Z", reference: "x", since: "2026-12-21T10:01:00Z" } }));
        render(<PlansPage />);
        const notice = await screen.findByRole("region", { name: "Payment under review" });
        expect(notice.textContent).toContain("$25.00");
        cleanup();
        get.mockResolvedValue(view({ current: providerPlan(), paymentUnderReview: { amountMinor: 2500, currency: "USD", paidAt: null, reference: "x", since: "2026-12-21T10:01:00Z" },
            renewal: { state: "REFUND_PENDING", timeZone: ZONE, refund: { amountMinor: 2500, currency: "USD", reason: "RENEWAL_DUPLICATE_PERIOD" } } }));
        render(<PlansPage />);
        expect(await screen.findByRole("region", { name: "Refund in progress" })).toBeTruthy();
        expect(screen.queryByRole("region", { name: "Payment under review" })).toBeNull();
    });

    it("shows nothing new for trials, manual and owner plans", async () => {
        get.mockResolvedValue(view({ current: { planCode: "MODEL_2", status: "ACTIVE", periodEnd: null, sourceLabel: "Set by Agafari", outsideCurrentConfiguration: false } }));
        render(<PlansPage />);
        await screen.findByRole("region", { name: "Subscription & Plans" });
        expect(screen.queryByRole("button", { name: "Update card" })).toBeNull();
        for (const name of ["Payment failed", "Your plan ended", "Refund in progress", "Payment under review"]) expect(screen.queryByRole("region", { name })).toBeNull();
    });
});
