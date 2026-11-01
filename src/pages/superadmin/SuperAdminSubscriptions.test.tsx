// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

// AGF E4-M3 (AC11): the Super Admin lists restaurants, opens one, sees its current subscription, history and computed
// entitlements, records a manual subscription (no payment verified) for an enabled plan and ends it, each as a separate
// confirmed action. There is no plan-change action.

const plans = vi.fn();
const monetizationConfig = vi.fn();
const businesses = vi.fn();
const businessSubscription = vi.fn();
const fulfilPlanRequest = vi.fn();
const declinePlanRequest = vi.fn();
const subscriptionHistory = vi.fn();
const recordSubscription = vi.fn();
const endSubscription = vi.fn();
vi.mock("../../api/adminApi", async (orig) => ({
    ...(await orig<typeof import("../../api/adminApi")>()),
    adminApi: { plans, monetizationConfig, businesses, businessSubscription, subscriptionHistory, recordSubscription, endSubscription,
        fulfilPlanRequest, declinePlanRequest },
}));

const { default: SuperAdminSubscriptions } = await import("./SuperAdminSubscriptions.tsx");

const plan = (code: string, enabled: boolean) => ({ code, model: code, setting: code === "MODEL_1" ? "SETTING_1" : "SETTING_2",
    adSource: "NONE", paid: true, enabledByCurrentConfiguration: enabled });
const sub = (over: Record<string, unknown> = {}) => ({
    id: "s1", businessId: "b1", planCode: "MODEL_4", status: "ACTIVE", configVersion: 2, periodEnd: null, transitionDate: null,
    source: "MANUAL", paymentVerified: false, sourceLabel: "Manual record, no payment verified", createdAt: "2026-11-01T10:00:00Z",
    createdBy: "r***@admin.test", updatedAt: "2026-11-01T10:00:00Z", endedAt: null, rowVersion: 0, outsideCurrentConfiguration: false, ...over,
});
const inactive = { mode: "INACTIVE", planCode: null, status: null, adSource: "NONE", restaurantAdManager: false, limits: {}, source: null, degraded: false };
const view = (current: unknown, monetizationActive = false) => ({
    data: { businessId: "b1", businessName: "Cafe One", ...(current ? { current } : {}), entitlements: inactive, monetizationActive } });

beforeEach(() => {
    for (const fn of [plans, monetizationConfig, businesses, businessSubscription, subscriptionHistory, recordSubscription, endSubscription]) fn.mockReset();
    plans.mockResolvedValue({ data: [plan("MODEL_1", false), plan("MODEL_2", true), plan("MODEL_3", false), plan("MODEL_4", true)] });
    monetizationConfig.mockResolvedValue({ data: { configured: true, version: 2, setting: "SETTING_2", models: ["MODEL_2", "MODEL_4"] } });
    businesses.mockResolvedValue({ data: { items: [
        { id: "b1", name: "Cafe One", slug: "cafe-one", createdAt: "2026-10-01T10:00:00Z", subscriptionStatus: null, planCode: null },
        { id: "b2", name: "Bar Two", slug: "bar-two", createdAt: "2026-10-02T10:00:00Z", subscriptionStatus: "ACTIVE", planCode: "MODEL_2" },
    ], page: 0, size: 20, total: 2 } });
    businessSubscription.mockResolvedValue(view(null));
    subscriptionHistory.mockResolvedValue({ data: [] });
    recordSubscription.mockResolvedValue({ data: sub() });
    endSubscription.mockResolvedValue({ data: sub({ status: "EXPIRED", endedAt: "2026-11-02T10:00:00Z", rowVersion: 1 }) });
});
afterEach(() => { cleanup(); localStorage.clear(); });

async function openCafe() {
    render(<SuperAdminSubscriptions />);
    const table = await screen.findByRole("table", { name: "Restaurants" });
    fireEvent.click(within(table).getByRole("button", { name: "Open Cafe One" }));
    return screen.findByRole("region", { name: "Cafe One subscription" });
}

describe("Super Admin subscriptions", () => {
    it("lists restaurants with their subscription status and searches by name", async () => {
        render(<SuperAdminSubscriptions />);
        const table = await screen.findByRole("table", { name: "Restaurants" });
        expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Restaurant", "Address", "Subscription", "Actions"]);
        expect(within(table).getAllByRole("row")[1].textContent).toContain("No subscription");
        expect(within(table).getAllByRole("row")[2].textContent).toContain("ACTIVE · Model 2");
        expect(businesses).toHaveBeenCalledWith("", 0, 20);
        fireEvent.change(screen.getByLabelText("Search restaurants"), { target: { value: "bar" } });
        fireEvent.click(screen.getByRole("button", { name: "Search" }));
        await waitFor(() => expect(businesses).toHaveBeenLastCalledWith("bar", 0, 20));
    });

    it("says when monetization is inactive and shows the restaurant without a subscription", async () => {
        const detail = await openCafe();
        expect(detail.textContent).toContain("No subscription");
        expect(detail.textContent).toContain("Monetization is inactive: every restaurant keeps today's features.");
        expect(businessSubscription).toHaveBeenCalledWith("b1");
        expect(subscriptionHistory).toHaveBeenCalledWith("b1");
    });

    it("offers only the plans the current configuration enables and records after a confirmation that no payment is verified", async () => {
        await openCafe();
        const select = screen.getByLabelText("Plan") as HTMLSelectElement;
        expect(Array.from(select.options).map((o) => o.value)).toEqual(["", "MODEL_2", "MODEL_4"]);
        fireEvent.change(select, { target: { value: "MODEL_4" } });
        businessSubscription.mockResolvedValue(view(sub()));
        fireEvent.click(screen.getByRole("button", { name: "Record subscription" }));

        const dialog = screen.getByRole("dialog", { name: "Record subscription" });
        expect(dialog.textContent).toContain("Model 4");
        expect(dialog.textContent).toContain("Manual record. No payment is taken or verified.");
        expect(recordSubscription).not.toHaveBeenCalled();
        fireEvent.click(within(dialog).getByRole("button", { name: "Record" }));

        await waitFor(() => expect(recordSubscription).toHaveBeenCalledWith("b1", { planCode: "MODEL_4", expectedConfigVersion: 2 }));
        const detail = await screen.findByRole("region", { name: "Cafe One subscription" });
        await waitFor(() => expect(detail.textContent).toContain("Manual record, no payment verified"));
        expect(detail.textContent).toContain("Model 4");
        expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("ends the current subscription as its own confirmed action and offers no plan change", async () => {
        businessSubscription.mockResolvedValue(view(sub({ rowVersion: 3 })));
        const detail = await openCafe();
        expect(within(detail).queryByRole("button", { name: /change plan/i })).toBeNull();
        expect(screen.queryByLabelText("Plan")).toBeNull(); // no record form while a subscription is current
        businessSubscription.mockResolvedValue(view(null));
        subscriptionHistory.mockResolvedValue({ data: [sub({ status: "EXPIRED", endedAt: "2026-11-02T10:00:00Z" })] });
        fireEvent.click(within(detail).getByRole("button", { name: "End subscription" }));

        const dialog = screen.getByRole("dialog", { name: "End subscription" });
        expect(dialog.textContent).toContain("Ended subscriptions are kept in the history and can't be changed.");
        fireEvent.click(within(dialog).getByRole("button", { name: "End subscription" }));
        await waitFor(() => expect(endSubscription).toHaveBeenCalledWith("b1", 3));
        const history = await screen.findByRole("table", { name: "Subscription history" });
        expect(within(history).getAllByRole("row")[1].textContent).toContain("EXPIRED");
    });

    it("flags a subscription outside the current configuration and shows the history with configuration versions", async () => {
        businessSubscription.mockResolvedValue(view(sub({ outsideCurrentConfiguration: true }), true));
        subscriptionHistory.mockResolvedValue({ data: [sub({ outsideCurrentConfiguration: true }), sub({ id: "s0", planCode: "MODEL_2", status: "EXPIRED", configVersion: 1 })] });
        const detail = await openCafe();
        expect(detail.textContent).toContain("Outside current configuration");
        expect(detail.textContent).not.toContain("Monetization is inactive");
        const region = screen.getByRole("region", { name: "Subscription history (scrolls sideways)" });
        expect(region.getAttribute("tabindex")).toBe("0");
        const table = within(region).getByRole("table", { name: "Subscription history" });
        expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Plan", "Status", "Configuration", "Recorded", "Ended", "Source"]);
        expect(within(table).getAllByRole("row")[2].textContent).toContain("Version 1");
    });

    it("on a conflict shows the server message and reloads the restaurant", async () => {
        recordSubscription.mockRejectedValue({ response: { status: 409, data: { code: "SUBSCRIPTION_EXISTS",
            message: "This restaurant already has a current subscription. End it before recording a new one." } } });
        await openCafe();
        fireEvent.change(screen.getByLabelText("Plan"), { target: { value: "MODEL_2" } });
        fireEvent.click(screen.getByRole("button", { name: "Record subscription" }));
        fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Record" }));
        expect((await screen.findByRole("alert")).textContent).toContain("already has a current subscription");
        await waitFor(() => expect(businessSubscription).toHaveBeenCalledTimes(2));
    });

    it("never touches the owner session", async () => {
        localStorage.setItem("token", "owner-token");
        await openCafe();
        fireEvent.change(screen.getByLabelText("Plan"), { target: { value: "MODEL_2" } });
        fireEvent.click(screen.getByRole("button", { name: "Record subscription" }));
        fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Record" }));
        await waitFor(() => expect(recordSubscription).toHaveBeenCalled());
        expect(localStorage.getItem("token")).toBe("owner-token");
    });

    it("shows a pending plan request with fulfil and decline instead of the record form (AGF E4-M4)", async () => {
        businessSubscription.mockResolvedValue({ data: { businessId: "b1", businessName: "Cafe One", entitlements: inactive, monetizationActive: false,
            pendingRequest: { id: "r1", planCode: "MODEL_4", configVersion: 2, requestedAt: "2026-11-01T10:00:00Z", rowVersion: 0, outsideCurrentConfiguration: false } } });
        fulfilPlanRequest.mockResolvedValue({ data: {} });
        const detail = await openCafe();
        expect(detail.textContent).toContain("Plan request: Model 4");
        expect(screen.queryByLabelText("Plan")).toBeNull();
        fireEvent.click(within(detail).getByRole("button", { name: "Fulfil request from Cafe One" }));
        fireEvent.click(within(screen.getByRole("dialog", { name: "Fulfil plan request" })).getByRole("button", { name: "Fulfil" }));
        await waitFor(() => expect(fulfilPlanRequest).toHaveBeenCalledWith("r1", 2, 0));
    });
});

