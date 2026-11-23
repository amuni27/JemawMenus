// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

// AGF E4-M4 (AC1–AC5, AC7, AC12), moved from the account page's Plan section to the Subscription & Plans page (ONB Phase 1,
// UX-AC1…AC8): hidden unless the backend says visible; under Setting 2 the owner sees only the enabled plans with the approved
// names and benefits, without prices, and requests one (a request, never a subscription); under Setting 1 status only;
// with a current subscription no request or change; features always stay available.
// AGF F5 (register §87): paid plans are never requested from this page; without checkout they say "Payment not available yet".

const get = vi.fn();
const request = vi.fn();
const withdraw = vi.fn();
const activate = vi.fn();
const startTrial = vi.fn();
vi.mock("../../api/planApi", () => ({ default: { get, request, withdraw, activate, startTrial } }));
// AGF FE-1: the session's email verification state (the same source as the owner area's verification banner)
type Verification = { verified: boolean; available: boolean; publishGateEnabled: boolean };
const refresh = vi.fn();
const auth = { value: { user: { email: "owner@cafe.test", emailVerification: { verified: true, available: true, publishGateEnabled: false } as Verification }, refresh } };
vi.mock("../../app/context/AuthContext", () => ({ useAuth: () => auth.value }));

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
const pendingFree = { ...pending, planCode: "MODEL_2" };
const UNAVAILABLE = "Payment not available yet";

beforeEach(() => {
    for (const fn of [get, request, withdraw, activate, startTrial, refresh]) fn.mockReset();
    auth.value.user.emailVerification = { verified: true, available: true, publishGateEnabled: false };
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
        expect(section.textContent).toContain("Price not available"); // AGF SA-P1
        expect(section.textContent).toContain("All features stay available while plans are being introduced.");
        expect(section.textContent).not.toMatch(/ETB|USD|\$|price:/i);
        expect(within(section).getAllByRole("button", { name: /^Request / }).map((b) => b.textContent)).toEqual(["Request Free with Ads"]);
        expect(within(section).queryByRole("button", { name: "Request Ad-Free" })).toBeNull();
        expect(section.textContent).toContain(UNAVAILABLE);
    });

    it("requests the free plan after a confirmation (self-service off) and then shows the pending request", async () => {
        render(<PlansPage />);
        const section = await screen.findByRole("region", { name: "Subscription & Plans" });
        get.mockResolvedValue(setting2({ pendingRequest: pendingFree, canRequest: false }));
        fireEvent.click(within(section).getByRole("button", { name: "Request Free with Ads" }));

        const dialog = screen.getByRole("dialog", { name: "Request a plan" });
        expect(dialog.textContent).toContain("Free with Ads");
        expect(dialog.textContent).toContain("This is a request, not a purchase. The Agafari team will contact you.");
        expect(request).not.toHaveBeenCalled();
        fireEvent.click(within(dialog).getByRole("button", { name: "Send request" }));

        await waitFor(() => expect(request).toHaveBeenCalledWith("MODEL_2", 3));
        await waitFor(() => expect(section.textContent).toContain("Request for Free with Ads sent on"));
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
        await waitFor(() => expect(within(section).getAllByRole("button", { name: /^Request / })).toHaveLength(1));
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
            expect(within(section).queryByRole("button", { name: "Request Ad-Free" })).toBeNull();
            expect(section.textContent).toContain(UNAVAILABLE);
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
            expect(screen.getByRole("heading", { level: 2, name: "Subscription & Plans" })).toBeTruthy();
        });
    });

    describe("Start free (Self-Service Phase A)", () => {
        const all = [{ code: "MODEL_2", model: "MODEL_2", adSource: "AGAFARI", paid: false }, { code: "MODEL_3", model: "MODEL_3", adSource: "RESTAURANT", paid: true },
            { code: "MODEL_4", model: "MODEL_4", adSource: "NONE", paid: true }];
        const card = async (name: string) => within(await screen.findByRole("region", { name: "Available plans" })).getAllByRole("article")
            .find((c) => within(c).getByRole("heading").textContent === name)!;

        it("offers Start free on the free plan only while self-service is available; paid plans aren't requestable", async () => {
            get.mockResolvedValue(setting2({ plans: all, selfService: { available: true, verificationRequired: false } }));
            render(<PlansPage />);
            const free = await card("Free with Ads");
            expect(within(free).getByRole("button", { name: "Start free" })).toBeTruthy();
            expect(within(free).queryByRole("button", { name: /^Request / })).toBeNull();
            expect(within(await card("Ad-Free")).queryByRole("button")).toBeNull();
            expect((await card("Ad-Free")).textContent).toContain(UNAVAILABLE);
            expect(screen.queryByText(/Requesting a plan doesn't charge you/)).toBeNull(); // nothing can be requested
            cleanup();

            get.mockResolvedValue(setting2({ plans: all })); // self-service off: today's request flow
            render(<PlansPage />);
            expect(within(await card("Free with Ads")).getByRole("button", { name: "Request Free with Ads" })).toBeTruthy();
            expect(screen.queryByRole("button", { name: "Start free" })).toBeNull();
        });

        it("starts Free with Ads after the approved confirmation and reloads", async () => {
            get.mockResolvedValue(setting2({ plans: all, selfService: { available: true, verificationRequired: false } }));
            activate.mockResolvedValue({ data: { subscriptionId: "s1", planCode: "MODEL_2", status: "ACTIVE", created: true } });
            render(<PlansPage />);
            fireEvent.click(within(await card("Free with Ads")).getByRole("button", { name: "Start free" }));
            const dialog = screen.getByRole("dialog", { name: "Start Free with Ads?" });
            expect(dialog.textContent).toContain("Agafari will show one sponsored item on your guest menu. There's no charge.");
            expect(dialog.textContent).toContain("To change your plan later, contact the Agafari team.");
            expect(activate).not.toHaveBeenCalled();
            get.mockResolvedValue(setting2({ plans: all, canRequest: false, selfService: { available: false, verificationRequired: false },
                current: { planCode: "MODEL_2", status: "ACTIVE", periodEnd: null, sourceLabel: "Started by you", outsideCurrentConfiguration: false } }));
            fireEvent.click(within(dialog).getByRole("button", { name: "Start free" }));
            await waitFor(() => expect(activate).toHaveBeenCalledWith("MODEL_2", 3, undefined));
            const section = await screen.findByRole("region", { name: "Subscription & Plans" });
            await waitFor(() => expect(section.textContent).toContain("Free with Ads · Active"));
            expect(section.textContent).toContain("Started by you");
        });

        it("with a pending request, names it on the card and asks to withdraw it explicitly (Keep my request first)", async () => {
            get.mockResolvedValue(setting2({ plans: all, canRequest: false, pendingRequest: pending, selfService: { available: true, verificationRequired: false } }));
            activate.mockResolvedValue({ data: { subscriptionId: "s1", planCode: "MODEL_2", status: "ACTIVE", created: true, withdrawnRequestId: "r1" } });
            render(<PlansPage />);
            const free = await card("Free with Ads");
            expect(free.textContent).toContain("You have a pending request for Ad-Free. Starting Free with Ads will withdraw it.");
            fireEvent.click(within(free).getByRole("button", { name: "Start free" }));
            let dialog = screen.getByRole("dialog", { name: "Start Free with Ads and withdraw your request for Ad-Free?" });
            expect(dialog.textContent).toContain("Your request for Ad-Free will be withdrawn. Agafari will show one sponsored item on your guest menu. There's no charge.");
            const keep = within(dialog).getByRole("button", { name: "Keep my request" });
            expect(document.activeElement).toBe(keep);
            fireEvent.click(keep);
            expect(activate).not.toHaveBeenCalled();
            expect(screen.queryByRole("dialog", { name: /withdraw your request/ })).toBeNull();

            fireEvent.click(within(await card("Free with Ads")).getByRole("button", { name: "Start free" }));
            dialog = screen.getByRole("dialog", { name: "Start Free with Ads and withdraw your request for Ad-Free?" });
            fireEvent.click(within(dialog).getByRole("button", { name: "Withdraw request and start free" }));
            await waitFor(() => expect(activate).toHaveBeenCalledWith("MODEL_2", 3, { id: "r1", rowVersion: 0 }));
        });

        it("asks for a verified email first when verification is required", async () => {
            get.mockResolvedValue(setting2({ plans: all, selfService: { available: true, verificationRequired: true } }));
            render(<PlansPage />);
            const free = await card("Free with Ads");
            expect(free.textContent).toContain("Verify your email to start Free with Ads.");
            expect((within(free).getByRole("button", { name: "Start free" }) as HTMLButtonElement).disabled).toBe(true);
        });

        it("shows the server's message when starting fails and reloads", async () => {
            get.mockResolvedValue(setting2({ plans: all, selfService: { available: true, verificationRequired: false } }));
            activate.mockRejectedValue({ response: { status: 409, data: { code: "PLAN_REQUEST_CHANGED", message: "Your plan request changed. Reload and try again." } } });
            render(<PlansPage />);
            fireEvent.click(within(await card("Free with Ads")).getByRole("button", { name: "Start free" }));
            fireEvent.click(within(screen.getByRole("dialog", { name: "Start Free with Ads?" })).getByRole("button", { name: "Start free" }));
            expect((await screen.findByRole("alert")).textContent).toContain("Your plan request changed. Reload and try again.");
            await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
        });
    });

    // AGF FE-1 (register §45 D-3, §46 Q1/Q2, §47): under Setting 1 the owner starts the free trial themselves, only while the
    // backend says the restaurant is eligible, after an explicit confirmation; the trial terms follow the accepted policy
    // (30 days, E4-Q2a; no charge; one per restaurant; the Agafari team follows up, E4-M5).
    describe("Start Free Trial (FE-1)", () => {
        const setting1 = (over: Record<string, unknown> = {}) => ({ data: { visible: true, setting: "SETTING_1", configVersion: 1, plans: [], canRequest: false,
            trialAvailable: false, featuresUnaffected: true, trialEligible: true, ...over } });
        const running = { startedAt: "2026-11-19T09:00:00Z", endsAt: "2026-12-19T09:00:00Z", daysLeft: 30, effectiveStatus: "TRIAL", timeZone: "Africa/Addis_Ababa" };
        const started = { subscriptionId: "t1", planCode: "MODEL_1", status: "TRIAL", created: true, withdrawnRequestId: null };
        const section = () => screen.findByRole("region", { name: "Subscription & Plans" });
        const confirm = async () => {
            fireEvent.click(within(await section()).getByRole("button", { name: "Start free trial" }));
            return screen.getByRole("dialog", { name: "Start your 30-day free trial?" });
        };

        it("offers the trial with its terms only while the restaurant is eligible", async () => {
            get.mockResolvedValue(setting1());
            render(<PlansPage />);
            const s = await section();
            const offer = within(s).getByRole("region", { name: "Free trial" });
            expect(offer.textContent).toContain("Try Agafari free for 30 days.");
            expect(offer.textContent).toContain("No payment details and no charge.");
            expect(offer.textContent).toContain("One free trial per restaurant.");
            expect(offer.textContent).toContain("Before it ends, the Agafari team will contact you about your plan.");
            expect(within(offer).getByRole("button", { name: "Start free trial" })).toBeTruthy();
            expect(s.textContent).not.toContain("Trial details aren't available yet");
            cleanup();

            for (const over of [{ trialEligible: false }, { trialEligible: undefined }, { trialEligible: true, trial: running },
                { trialEligible: true, current: { planCode: "MODEL_1", status: "ACTIVE", periodEnd: null, sourceLabel: null, outsideCurrentConfiguration: false } }]) {
                get.mockResolvedValue(setting1(over));
                render(<PlansPage />);
                expect(within(await section()).queryByRole("button", { name: "Start free trial" })).toBeNull();
                cleanup();
            }
        });

        it("never offers the trial under Setting 2", async () => {
            get.mockResolvedValue(setting2({ trialEligible: true }));
            render(<PlansPage />);
            const s = await section();
            expect(within(s).queryByRole("button", { name: "Start free trial" })).toBeNull();
            expect(within(s).getAllByRole("button", { name: /^Request / })).toHaveLength(1); // AGF F5: the free plan only
        });

        it("starts only after an explicit confirmation, then shows the running trial", async () => {
            get.mockResolvedValue(setting1());
            startTrial.mockResolvedValue({ status: 201, data: started });
            render(<PlansPage />);
            let dialog = await confirm();
            expect(dialog.textContent).toContain("Your free trial lasts 30 days. There's no charge and no payment details are needed.");
            expect(dialog.textContent).toContain("Each restaurant can have one free trial.");
            fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
            expect(startTrial).not.toHaveBeenCalled();
            expect(screen.queryByRole("dialog", { name: "Start your 30-day free trial?" })).toBeNull();

            dialog = await confirm();
            get.mockResolvedValue(setting1({ trialEligible: false, trialAvailable: true, trial: running }));
            fireEvent.click(within(dialog).getByRole("button", { name: "Start free trial" }));
            await waitFor(() => expect(startTrial).toHaveBeenCalledWith(1));
            expect(startTrial).toHaveBeenCalledTimes(1);
            const s = await section();
            await waitFor(() => expect(s.textContent).toContain("Free trial: 30 days left"));
            expect(within(s).getByRole("status").textContent).toContain("Your free trial has started.");
            expect(within(s).queryByRole("button", { name: "Start free trial" })).toBeNull();
            expect(screen.queryByRole("alert")).toBeNull();
        });

        it("a repeated click confirms the trial that is already running", async () => {
            get.mockResolvedValue(setting1());
            startTrial.mockResolvedValue({ status: 200, data: { ...started, created: false } });
            render(<PlansPage />);
            const dialog = await confirm();
            get.mockResolvedValue(setting1({ trialEligible: false, trial: running }));
            fireEvent.click(within(dialog).getByRole("button", { name: "Start free trial" }));
            expect((await screen.findByRole("status")).textContent).toContain("Your free trial is already running.");
            await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
        });

        it("sends one request however often the confirmation is clicked", async () => {
            get.mockResolvedValue(setting1());
            let finish: (v: unknown) => void = () => {};
            startTrial.mockReturnValue(new Promise((r) => { finish = r; }));
            render(<PlansPage />);
            const dialog = await confirm();
            const button = within(dialog).getByRole("button", { name: "Start free trial" });
            fireEvent.click(button);
            await waitFor(() => expect((within(dialog).getByRole("button", { name: "Starting…" }) as HTMLButtonElement).disabled).toBe(true));
            fireEvent.click(within(dialog).getByRole("button", { name: "Starting…" }));
            expect(startTrial).toHaveBeenCalledTimes(1);
            finish({ status: 201, data: started });
            await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
        });

        it("on a configuration change says so and reloads the plans", async () => {
            get.mockResolvedValue(setting1());
            startTrial.mockRejectedValue({ response: { status: 409, data: { code: "CONFIG_VERSION_CONFLICT", message: "The available plans changed. Reload and try again." } } });
            render(<PlansPage />);
            const dialog = await confirm();
            get.mockResolvedValue(setting1({ configVersion: 2 }));
            fireEvent.click(within(dialog).getByRole("button", { name: "Start free trial" }));
            expect((await screen.findByRole("alert")).textContent).toContain("The available plans changed. We've updated this page; check it and try again.");
            await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
            startTrial.mockResolvedValue({ status: 201, data: started });
            fireEvent.click(within(await confirm()).getByRole("button", { name: "Start free trial" }));
            await waitFor(() => expect(startTrial).toHaveBeenLastCalledWith(2)); // the reloaded version
        });

        it.each([
            ["SUBSCRIPTION_EXISTS", 409, "Your restaurant already has a plan."],
            ["TRIAL_ALREADY_USED", 409, "Your restaurant has already had its free trial."],
            ["PLAN_REQUEST_PENDING", 409, "You have a pending plan request."],
            ["TRIAL_NOT_OFFERED", 409, "A free trial isn't offered for your restaurant."],
            ["TRIALS_DISABLED", 403, "Free trials aren't available."],
            ["MONETIZATION_NOT_CONFIGURED", 400, "Plans aren't available yet."],
        ])("shows the refusal %s and reloads", async (code, status, message) => {
            get.mockResolvedValue(setting1());
            startTrial.mockRejectedValue({ response: { status, data: { code, message } } });
            render(<PlansPage />);
            fireEvent.click(within(await confirm()).getByRole("button", { name: "Start free trial" }));
            expect((await screen.findByRole("alert")).textContent).toContain(message);
            await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
            expect(screen.queryByRole("status")).toBeNull();
        });

        it("falls back to a plain message when the server sends none", async () => {
            get.mockResolvedValue(setting1());
            startTrial.mockRejectedValue({ response: { status: 500, data: {} } });
            render(<PlansPage />);
            fireEvent.click(within(await confirm()).getByRole("button", { name: "Start free trial" }));
            expect((await screen.findByRole("alert")).textContent).toContain("Couldn't start your free trial. Please try again.");
        });

        it("asks for a verified email instead of offering a start while verification is required (Q2)", async () => {
            auth.value.user.emailVerification = { verified: false, available: true, publishGateEnabled: false };
            get.mockResolvedValue(setting1());
            render(<PlansPage />);
            const offer = within(await section()).getByRole("region", { name: "Free trial" });
            expect(offer.textContent).toContain("Verify your email to start your free trial. We sent a link to owner@cafe.test.");
            expect(offer.textContent).toContain("Use Resend link at the top of the page if you need a new one.");
            expect(within(offer).queryByRole("button", { name: "Start free trial" })).toBeNull();
            cleanup();

            auth.value.user.emailVerification = { verified: false, available: false, publishGateEnabled: false }; // no email provider yet
            render(<PlansPage />);
            expect(within(await section()).getByRole("button", { name: "Start free trial" })).toBeTruthy();
        });

        it("when the server still asks for verification, explains it and refreshes the session", async () => {
            get.mockResolvedValue(setting1());
            startTrial.mockRejectedValue({ response: { status: 403, data: { code: "EMAIL_NOT_VERIFIED", message: "Verify your email to start your free trial." } } });
            render(<PlansPage />);
            fireEvent.click(within(await confirm()).getByRole("button", { name: "Start free trial" }));
            expect((await screen.findByRole("alert")).textContent).toContain("Verify your email to start your free trial.");
            await waitFor(() => expect(refresh).toHaveBeenCalled());
        });
    });
});
