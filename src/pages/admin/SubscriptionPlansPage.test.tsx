// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

// AGF E4-M4 (AC1–AC5, AC7, AC12), moved from the account page's Plan section to the Subscription & Plans page (ONB Phase 1,
// UX-AC1…AC8): hidden unless the backend says visible; under Setting 2 the owner sees only the enabled plans with the approved
// names and benefits, without prices, and requests one (a request, never a subscription); under Setting 1 status only;
// with a current subscription no request or change; features always stay available.

const get = vi.fn();
const request = vi.fn();
const withdraw = vi.fn();
vi.mock("../../api/planApi", () => ({ default: { get, request, withdraw } }));

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

const plans = [{ code: "MODEL_2", model: "MODEL_2", adSource: "AGAFARI", paid: false }, { code: "MODEL_4", model: "MODEL_4", adSource: "NONE", paid: true }];
const setting2 = (over: Record<string, unknown> = {}) => ({ data: { visible: true, setting: "SETTING_2", configVersion: 3, plans, canRequest: true,
    trialAvailable: false, featuresUnaffected: true, ...over } });
const pending = { id: "r1", planCode: "MODEL_4", configVersion: 3, requestedAt: "2026-11-01T10:00:00Z", rowVersion: 0, outsideCurrentConfiguration: false };

beforeEach(() => {
    for (const fn of [get, request, withdraw]) fn.mockReset();
    get.mockResolvedValue(setting2());
    request.mockResolvedValue({ data: { id: "r1", status: "PENDING" } });
    withdraw.mockResolvedValue({ data: { id: "r1", status: "WITHDRAWN" } });
});
afterEach(() => { cleanup(); localStorage.clear(); });

describe("owner Subscription & Plans page", () => {
    it("goes back to the dashboard while plans aren't visible", async () => {
        get.mockResolvedValue({ data: { visible: false } });
        render(<PlansPage />);
        expect(await screen.findByText("Dashboard page")).toBeTruthy();
        expect(screen.queryByRole("region", { name: "Subscription & Plans" })).toBeNull();
    });

    it("lists the enabled plans without prices and says all features stay available", async () => {
        render(<PlansPage />);
        const section = await screen.findByRole("region", { name: "Subscription & Plans" });
        expect(section.textContent).toContain("Free with Ads");
        expect(section.textContent).toContain("Ad-Free");
        expect(section.textContent).not.toContain("Business Ads"); // Model 3 isn't enabled in this configuration
        expect(section.textContent).toContain("Pricing will be announced");
        expect(section.textContent).toContain("All features stay available while plans are being introduced.");
        expect(section.textContent).not.toMatch(/ETB|USD|\$|price:/i);
        expect(within(section).getAllByRole("button", { name: /^Request / })).toHaveLength(2);
    });

    it("requests a plan after a confirmation and then shows the pending request", async () => {
        render(<PlansPage />);
        const section = await screen.findByRole("region", { name: "Subscription & Plans" });
        get.mockResolvedValue(setting2({ pendingRequest: pending, canRequest: false }));
        fireEvent.click(within(section).getByRole("button", { name: "Request Ad-Free" }));

        const dialog = screen.getByRole("dialog", { name: "Request a plan" });
        expect(dialog.textContent).toContain("Ad-Free");
        expect(dialog.textContent).toContain("This is a request, not a purchase. The Agafari team will contact you.");
        expect(request).not.toHaveBeenCalled();
        fireEvent.click(within(dialog).getByRole("button", { name: "Send request" }));

        await waitFor(() => expect(request).toHaveBeenCalledWith("MODEL_4", 3));
        await waitFor(() => expect(section.textContent).toContain("Request for Ad-Free sent on"));
        expect(within(section).queryByRole("button", { name: /^Request / })).toBeNull();
    });

    it("withdraws a pending request after a confirmation", async () => {
        get.mockResolvedValue(setting2({ pendingRequest: pending, canRequest: false }));
        render(<PlansPage />);
        const section = await screen.findByRole("region", { name: "Subscription & Plans" });
        get.mockResolvedValue(setting2());
        fireEvent.click(within(section).getByRole("button", { name: "Withdraw request" }));
        fireEvent.click(within(screen.getByRole("dialog", { name: "Withdraw request" })).getByRole("button", { name: "Withdraw" }));
        await waitFor(() => expect(withdraw).toHaveBeenCalledWith(0));
        await waitFor(() => expect(within(section).getAllByRole("button", { name: /^Request / })).toHaveLength(2));
    });

    it("under Setting 1 shows the plan model and that trial details aren't available, without a request action", async () => {
        get.mockResolvedValue({ data: { visible: true, setting: "SETTING_1", configVersion: 1, plans: [], canRequest: false, trialAvailable: false, featuresUnaffected: true } });
        render(<PlansPage />);
        const section = await screen.findByRole("region", { name: "Subscription & Plans" });
        expect(section.textContent).toContain("Your plan model: free trial, then a paid subscription.");
        expect(section.textContent).toContain("Trial details aren't available yet");
        expect(within(section).queryByRole("button")).toBeNull();
    });

    it("with a current subscription shows it, marks it as a manual record and offers no change", async () => {
        get.mockResolvedValue(setting2({ canRequest: false, current: { planCode: "MODEL_4", status: "ACTIVE", periodEnd: null,
            sourceLabel: "Manual record, no payment verified", outsideCurrentConfiguration: true } }));
        render(<PlansPage />);
        const section = await screen.findByRole("region", { name: "Subscription & Plans" });
        expect(section.textContent).toContain("Ad-Free · Active");
        expect(section.textContent).toContain("Manual record, no payment verified");
        expect(section.textContent).toContain("Your plan stays as it is for now.");
        expect(section.textContent).toContain("To change your plan, contact the Agafari team.");
        expect(within(section).queryByRole("button")).toBeNull();
    });

    it("shows the server message on a conflict and reloads", async () => {
        request.mockRejectedValue({ response: { status: 409, data: { code: "SUBSCRIPTION_EXISTS", message: "This restaurant already has a current subscription." } } });
        render(<PlansPage />);
        const section = await screen.findByRole("region", { name: "Subscription & Plans" });
        fireEvent.click(within(section).getByRole("button", { name: "Request Free with Ads" }));
        fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Send request" }));
        expect((await screen.findByRole("alert")).textContent).toContain("already has a current subscription");
        await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    });

    it("shows the running trial with days left, the last-week notice and the ended notice (AGF E4-M5)", async () => {
        const s1 = (trial: Record<string, unknown>) => ({ data: { visible: true, setting: "SETTING_1", configVersion: 1, plans: [], canRequest: false,
            trialAvailable: true, featuresUnaffected: true, trial: { startedAt: "2026-11-01T10:00:00Z", endsAt: "2026-12-01T10:00:00Z", ...trial } } });
        get.mockResolvedValue(s1({ daysLeft: 20, effectiveStatus: "TRIAL" }));
        render(<PlansPage />);
        let section = await screen.findByRole("region", { name: "Subscription & Plans" });
        expect(section.textContent).toContain("Free trial: 20 days left (ends");
        expect(section.textContent).not.toContain("Trial details aren't available yet");
        cleanup();

        get.mockResolvedValue(s1({ daysLeft: 5, effectiveStatus: "TRIAL" }));
        render(<PlansPage />);
        section = await screen.findByRole("region", { name: "Subscription & Plans" });
        expect(section.textContent).toContain("Your free trial ends in 5 days. The Agafari team will contact you about your plan.");
        cleanup();

        get.mockResolvedValue(s1({ daysLeft: 0, effectiveStatus: "EXPIRED" }));
        render(<PlansPage />);
        section = await screen.findByRole("region", { name: "Subscription & Plans" });
        expect(section.textContent).toContain("Your free trial ended on");
        expect(section.textContent).toContain("All features stay available for now. The Agafari team will contact you.");
        expect(within(section).queryByRole("button")).toBeNull();
    });

    it("shows the trial's last day in the restaurant's time zone, whatever the browser's is (AGF E4-M5)", async () => {
        const trial = (over: Record<string, unknown>) => ({ data: { visible: true, setting: "SETTING_1", configVersion: 1, plans: [], canRequest: false,
            trialAvailable: true, featuresUnaffected: true, trial: { startedAt: "2026-11-01T10:00:00Z", ...over } } });
        get.mockResolvedValue(trial({ endsAt: "2027-01-01T06:00:00Z", daysLeft: 20, effectiveStatus: "TRIAL", timeZone: "America/Chicago" }));
        render(<PlansPage />);
        let section = await screen.findByRole("region", { name: "Subscription & Plans" });
        expect(section.textContent).toContain("Free trial: 20 days left (ends 12/31/2026).");
        cleanup();

        get.mockResolvedValue(trial({ endsAt: "2026-12-31T21:00:00Z", daysLeft: 0, effectiveStatus: "EXPIRED", timeZone: "Africa/Addis_Ababa" }));
        render(<PlansPage />);
        section = await screen.findByRole("region", { name: "Subscription & Plans" });
        expect(section.textContent).toContain("Your free trial ended on 12/31/2026.");
    });

    describe("grandfathering notices (AGF E4-M6)", () => {
        const current = (grandfathering: Record<string, unknown>) => ({ planCode: "MODEL_3", status: "ACTIVE", periodEnd: "2027-01-01T06:00:00Z",
            sourceLabel: "Manual record, no payment verified", outsideCurrentConfiguration: true,
            grandfathering: { timeZone: "America/Chicago", transitionsEnabled: true, ...grandfathering } });

        it("says the plan is no longer offered and stays active until its end, with a last-week warning only when transitions are on", async () => {
            get.mockResolvedValue(setting2({ canRequest: false, current: current({ until: "2027-01-01T06:00:00Z", daysLeft: 20 }) }));
            render(<PlansPage />);
            let section = await screen.findByRole("region", { name: "Subscription & Plans" });
            expect(section.textContent).toContain("Your plan (Business Ads) is no longer offered. It stays active until 12/31/2026.");
            expect(section.textContent).not.toContain("ends in");
            cleanup();

            get.mockResolvedValue(setting2({ canRequest: false, current: current({ until: "2027-01-01T06:00:00Z", daysLeft: 5 }) }));
            render(<PlansPage />);
            section = await screen.findByRole("region", { name: "Subscription & Plans" });
            expect(section.textContent).toContain("Your plan (Business Ads) ends in 5 days, on 12/31/2026. After that you can choose one of the available plans.");
            cleanup();

            get.mockResolvedValue(setting2({ canRequest: false, current: current({ until: "2027-01-01T06:00:00Z", daysLeft: 5, transitionsEnabled: false }) }));
            render(<PlansPage />);
            section = await screen.findByRole("region", { name: "Subscription & Plans" });
            expect(section.textContent).toContain("It stays active until 12/31/2026.");
            expect(section.textContent).not.toContain("ends in");
            cleanup();

            get.mockResolvedValue({ data: { visible: true, setting: "SETTING_1", configVersion: 3, plans: [], canRequest: false, featuresUnaffected: true,
                current: current({ until: "2027-01-01T06:00:00Z", daysLeft: 3 }) } });
            render(<PlansPage />);
            section = await screen.findByRole("region", { name: "Subscription & Plans" });
            expect(section.textContent).toContain("Your plan (Business Ads) ends in 3 days, on 12/31/2026. After that, contact the Agafari team to continue.");
        });

        it("says an open-ended grandfathered plan stays active for now, without promising contact", async () => {
            get.mockResolvedValue(setting2({ canRequest: false, current: { ...current({}), periodEnd: null } }));
            render(<PlansPage />);
            const section = await screen.findByRole("region", { name: "Subscription & Plans" });
            expect(section.textContent).toContain("Your plan (Business Ads) is no longer offered. It stays active for now.");
            expect(section.textContent).not.toContain("will contact you");
            expect(section.textContent).toContain("All features stay available");
        });

        it("after the end, lets the owner choose under Setting 2 and points to the Agafari team under Setting 1", async () => {
            const ended = { planCode: "MODEL_3", endedAt: "2027-01-01T06:00:00Z", timeZone: "America/Chicago" };
            get.mockResolvedValue(setting2({ endedPlan: ended }));
            render(<PlansPage />);
            let section = await screen.findByRole("region", { name: "Subscription & Plans" });
            expect(section.textContent).toContain("Your previous plan (Business Ads) ended on 12/31/2026. Choose a plan to continue.");
            expect(within(section).getByRole("button", { name: "Request Ad-Free" })).toBeTruthy();
            cleanup();

            get.mockResolvedValue({ data: { visible: true, setting: "SETTING_1", configVersion: 3, plans: [], canRequest: false, featuresUnaffected: true, endedPlan: ended } });
            render(<PlansPage />);
            section = await screen.findByRole("region", { name: "Subscription & Plans" });
            expect(section.textContent).toContain("Your previous plan (Business Ads) ended on 12/31/2026. Contact the Agafari team to continue with Model 1.");
        });
    });

    describe("comparison (ONB Phase 1)", () => {
        const all = [{ code: "MODEL_2", model: "MODEL_2", adSource: "AGAFARI", paid: false }, { code: "MODEL_3", model: "MODEL_3", adSource: "RESTAURANT", paid: true },
            { code: "MODEL_4", model: "MODEL_4", adSource: "NONE", paid: true }];

        it("shows one card per enabled plan with the approved names and benefits, and a comparison of only those plans", async () => {
            get.mockResolvedValue(setting2({ plans: all }));
            render(<PlansPage />);
            const available = await screen.findByRole("region", { name: "Available plans" });
            const cards = within(available).getAllByRole("article");
            expect(cards.map((c) => within(c).getByRole("heading").textContent)).toEqual(["Free with Ads", "Business Ads", "Ad-Free"]);
            expect(cards[0].textContent).toContain("Agafari shows one sponsored item on your guest menu, chosen by Agafari");
            expect(cards[1].textContent).toContain("Show your own sponsored items on your own menu, managed in Ads");
            expect(cards[1].textContent).toContain("No Agafari ads; you keep your advertising revenue");
            expect(cards[2].textContent).toContain("No ads on your guest menu");
            const table = within(available).getByRole("table", { name: "Plan comparison" });
            expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Feature", "Free with Ads", "Business Ads", "Ad-Free"]);
            expect(table.textContent).toContain("Ads on your guest menu");
            expect(available.textContent).not.toMatch(/ETB|USD|\$|per month|billing/i);
            expect(screen.getByText("Requesting a plan doesn't charge you; the Agafari team activates it.")).toBeTruthy();
            cleanup();

            get.mockResolvedValue(setting2({ plans: [all[1]] })); // only Business Ads enabled
            render(<PlansPage />);
            const only = await screen.findByRole("region", { name: "Available plans" });
            expect(within(only).getAllByRole("article")).toHaveLength(1);
            expect(within(within(only).getByRole("table", { name: "Plan comparison" })).getAllByRole("columnheader")).toHaveLength(2);
        });

        it("marks the current plan and the requested plan on their cards", async () => {
            get.mockResolvedValue(setting2({ plans: all, canRequest: false, current: { planCode: "MODEL_3", status: "ACTIVE", periodEnd: null,
                sourceLabel: null, outsideCurrentConfiguration: false } }));
            render(<PlansPage />);
            let available = await screen.findByRole("region", { name: "Available plans" });
            const current = within(available).getAllByRole("article").find((c) => c.textContent?.includes("Business Ads"))!;
            expect(within(current).getByText("Current plan")).toBeTruthy();
            expect(within(available).queryByRole("button")).toBeNull();
            cleanup();

            get.mockResolvedValue(setting2({ plans: all, canRequest: false, pendingRequest: pending }));
            render(<PlansPage />);
            available = await screen.findByRole("region", { name: "Available plans" });
            const requested = within(available).getAllByRole("article").find((c) => c.textContent?.includes("Ad-Free"))!;
            expect(within(requested).getByText("Requested")).toBeTruthy();
            expect(available.textContent).toContain("You have a pending request");
            expect(within(available).queryByRole("button", { name: /^Request / })).toBeNull();
            expect(screen.getByRole("button", { name: "Withdraw request" })).toBeTruthy();
        });

        it("under Setting 1 shows no plan comparison", async () => {
            get.mockResolvedValue({ data: { visible: true, setting: "SETTING_1", configVersion: 1, plans: [], canRequest: false, featuresUnaffected: true } });
            render(<PlansPage />);
            await screen.findByRole("region", { name: "Subscription & Plans" });
            expect(screen.queryByRole("region", { name: "Available plans" })).toBeNull();
            expect(screen.getByRole("heading", { level: 1, name: "Subscription & Plans" })).toBeTruthy();
        });
    });
});

