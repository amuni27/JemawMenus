// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

// AGF E4-M4 (AC1–AC5, AC7, AC12): the owner's Plan section. Hidden unless the backend says visible; under Setting 2 the
// owner sees the enabled plans without prices and requests one (a request, never a subscription); under Setting 1 status
// only; with a current subscription no request or change; features always stay available.

const get = vi.fn();
const request = vi.fn();
const withdraw = vi.fn();
vi.mock("../../api/planApi", () => ({ default: { get, request, withdraw } }));

const { default: PlanSection } = await import("./PlanSection.tsx");

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

describe("owner Plan section", () => {
    it("renders nothing while plans aren't visible", async () => {
        get.mockResolvedValue({ data: { visible: false } });
        const { container } = render(<PlanSection />);
        await waitFor(() => expect(get).toHaveBeenCalled());
        expect(container.textContent).toBe("");
    });

    it("lists the enabled plans without prices and says all features stay available", async () => {
        render(<PlanSection />);
        const section = await screen.findByRole("region", { name: "Plan" });
        expect(section.textContent).toContain("Model 2");
        expect(section.textContent).toContain("Free, with Agafari ads");
        expect(section.textContent).toContain("Model 4");
        expect(section.textContent).toContain("Pricing will be announced");
        expect(section.textContent).toContain("All features stay available while plans are being introduced.");
        expect(section.textContent).not.toMatch(/ETB|USD|\$|price:/i);
        expect(within(section).getAllByRole("button", { name: /Request Model/ })).toHaveLength(2);
    });

    it("requests a plan after a confirmation and then shows the pending request", async () => {
        render(<PlanSection />);
        const section = await screen.findByRole("region", { name: "Plan" });
        get.mockResolvedValue(setting2({ pendingRequest: pending, canRequest: false }));
        fireEvent.click(within(section).getByRole("button", { name: "Request Model 4" }));

        const dialog = screen.getByRole("dialog", { name: "Request a plan" });
        expect(dialog.textContent).toContain("Model 4");
        expect(dialog.textContent).toContain("This is a request, not a purchase. The Agafari team will contact you.");
        expect(request).not.toHaveBeenCalled();
        fireEvent.click(within(dialog).getByRole("button", { name: "Send request" }));

        await waitFor(() => expect(request).toHaveBeenCalledWith("MODEL_4", 3));
        await waitFor(() => expect(section.textContent).toContain("Request for Model 4 sent on"));
        expect(within(section).queryByRole("button", { name: /Request Model/ })).toBeNull();
    });

    it("withdraws a pending request after a confirmation", async () => {
        get.mockResolvedValue(setting2({ pendingRequest: pending, canRequest: false }));
        render(<PlanSection />);
        const section = await screen.findByRole("region", { name: "Plan" });
        get.mockResolvedValue(setting2());
        fireEvent.click(within(section).getByRole("button", { name: "Withdraw request" }));
        fireEvent.click(within(screen.getByRole("dialog", { name: "Withdraw request" })).getByRole("button", { name: "Withdraw" }));
        await waitFor(() => expect(withdraw).toHaveBeenCalledWith(0));
        await waitFor(() => expect(within(section).getAllByRole("button", { name: /Request Model/ })).toHaveLength(2));
    });

    it("under Setting 1 shows the plan model and that trial details aren't available, without a request action", async () => {
        get.mockResolvedValue({ data: { visible: true, setting: "SETTING_1", configVersion: 1, plans: [], canRequest: false, trialAvailable: false, featuresUnaffected: true } });
        render(<PlanSection />);
        const section = await screen.findByRole("region", { name: "Plan" });
        expect(section.textContent).toContain("Your plan model: free trial, then a paid subscription.");
        expect(section.textContent).toContain("Trial details aren't available yet");
        expect(within(section).queryByRole("button")).toBeNull();
    });

    it("with a current subscription shows it, marks it as a manual record and offers no change", async () => {
        get.mockResolvedValue(setting2({ canRequest: false, current: { planCode: "MODEL_4", status: "ACTIVE", periodEnd: null,
            sourceLabel: "Manual record, no payment verified", outsideCurrentConfiguration: true } }));
        render(<PlanSection />);
        const section = await screen.findByRole("region", { name: "Plan" });
        expect(section.textContent).toContain("Model 4 · Active");
        expect(section.textContent).toContain("Manual record, no payment verified");
        expect(section.textContent).toContain("Your plan stays as it is for now.");
        expect(within(section).queryByRole("button")).toBeNull();
    });

    it("shows the server message on a conflict and reloads", async () => {
        request.mockRejectedValue({ response: { status: 409, data: { code: "SUBSCRIPTION_EXISTS", message: "This restaurant already has a current subscription." } } });
        render(<PlanSection />);
        const section = await screen.findByRole("region", { name: "Plan" });
        fireEvent.click(within(section).getByRole("button", { name: "Request Model 2" }));
        fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Send request" }));
        expect((await screen.findByRole("alert")).textContent).toContain("already has a current subscription");
        await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    });
});
