// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

// AGF E4-M4 (AC8, AC12): the Super Admin sees pending plan requests and fulfils one (recording the manual subscription,
// no payment verified) or declines it, each after a confirmation; requests outside the current configuration are flagged.

const planRequests = vi.fn();
const fulfilPlanRequest = vi.fn();
const declinePlanRequest = vi.fn();
const monetizationConfig = vi.fn();
vi.mock("../../api/adminApi", async (orig) => ({
    ...(await orig<typeof import("../../api/adminApi")>()),
    adminApi: { planRequests, fulfilPlanRequest, declinePlanRequest, monetizationConfig },
}));

const { default: SuperAdminPlanRequests } = await import("./SuperAdminPlanRequests.tsx");

const req = (over: Record<string, unknown> = {}) => ({ id: "r1", businessId: "b1", businessName: "Cafe One", planCode: "MODEL_4", configVersion: 2,
    status: "PENDING", requestedAt: "2026-11-01T10:00:00Z", requestedBy: "o***@owner.test", rowVersion: 0, outsideCurrentConfiguration: false, ...over });

beforeEach(() => {
    for (const fn of [planRequests, fulfilPlanRequest, declinePlanRequest, monetizationConfig]) fn.mockReset();
    planRequests.mockResolvedValue({ data: { items: [req()], page: 0, size: 20, total: 1 } });
    monetizationConfig.mockResolvedValue({ data: { configured: true, version: 2, setting: "SETTING_2", models: ["MODEL_2", "MODEL_4"] } });
    fulfilPlanRequest.mockResolvedValue({ data: req({ status: "FULFILLED" }) });
    declinePlanRequest.mockResolvedValue({ data: req({ status: "DECLINED" }) });
});
afterEach(() => cleanup());

describe("Super Admin plan requests", () => {
    it("lists pending requests with restaurant, plan and requester", async () => {
        render(<SuperAdminPlanRequests />);
        const table = await screen.findByRole("table", { name: "Plan requests" });
        expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Restaurant", "Plan", "Requested", "Requested by", "Actions"]);
        expect(within(table).getAllByRole("row")[1].textContent).toContain("Cafe One");
        expect(within(table).getAllByRole("row")[1].textContent).toContain("Model 4");
        expect(planRequests).toHaveBeenCalledWith("PENDING", 0, 20);
    });

    it("fulfils after a confirmation that it records a manual subscription without payment", async () => {
        render(<SuperAdminPlanRequests />);
        const table = await screen.findByRole("table", { name: "Plan requests" });
        planRequests.mockResolvedValue({ data: { items: [], page: 0, size: 20, total: 0 } });
        fireEvent.click(within(table).getByRole("button", { name: "Fulfil request from Cafe One" }));
        const dialog = screen.getByRole("dialog", { name: "Fulfil plan request" });
        expect(dialog.textContent).toContain("Records a Model 4 subscription for Cafe One.");
        expect(dialog.textContent).toContain("Manual record. No payment is taken or verified.");
        fireEvent.click(within(dialog).getByRole("button", { name: "Fulfil" }));
        await waitFor(() => expect(fulfilPlanRequest).toHaveBeenCalledWith("r1", 2, 0));
        expect(await screen.findByText("No pending plan requests.")).toBeTruthy();
    });

    it("declines after a confirmation", async () => {
        render(<SuperAdminPlanRequests />);
        const table = await screen.findByRole("table", { name: "Plan requests" });
        fireEvent.click(within(table).getByRole("button", { name: "Decline request from Cafe One" }));
        fireEvent.click(within(screen.getByRole("dialog", { name: "Decline plan request" })).getByRole("button", { name: "Decline" }));
        await waitFor(() => expect(declinePlanRequest).toHaveBeenCalledWith("r1", 0));
    });

    it("flags a request outside the current configuration and offers only decline", async () => {
        planRequests.mockResolvedValue({ data: { items: [req({ outsideCurrentConfiguration: true })], page: 0, size: 20, total: 1 } });
        render(<SuperAdminPlanRequests />);
        const table = await screen.findByRole("table", { name: "Plan requests" });
        expect(table.textContent).toContain("Outside current configuration");
        expect(within(table).queryByRole("button", { name: /Fulfil/ })).toBeNull();
        expect(within(table).getByRole("button", { name: "Decline request from Cafe One" })).toBeTruthy();
    });

    it("shows the server message on a conflict and reloads", async () => {
        fulfilPlanRequest.mockRejectedValue({ response: { status: 409, data: { code: "PLAN_NOT_ENABLED",
            message: "This plan isn't enabled by the current configuration. Decline the request." } } });
        render(<SuperAdminPlanRequests />);
        const table = await screen.findByRole("table", { name: "Plan requests" });
        fireEvent.click(within(table).getByRole("button", { name: "Fulfil request from Cafe One" }));
        fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Fulfil" }));
        expect((await screen.findByRole("alert")).textContent).toContain("isn't enabled by the current configuration");
        await waitFor(() => expect(planRequests).toHaveBeenCalledTimes(2));
    });
});
