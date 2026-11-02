// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// AGF E4-M4: the dashboard Plan card summarizes the plan status and links to the account page; hidden unless visible.

const get = vi.fn();
vi.mock("../../api/planApi", () => ({ default: { get } }));

const { default: PlanCard } = await import("./PlanCard.tsx");

const show = () => render(<MemoryRouter><PlanCard accountHref="/b1/admin/account" /></MemoryRouter>);

beforeEach(() => get.mockReset());
afterEach(() => cleanup());

describe("dashboard Plan card", () => {
    it("renders nothing while plans aren't visible", async () => {
        get.mockResolvedValue({ data: { visible: false } });
        const { container } = show();
        await waitFor(() => expect(get).toHaveBeenCalled());
        expect(container.textContent).toBe("");
    });

    it("invites a choice when plans can be requested", async () => {
        get.mockResolvedValue({ data: { visible: true, setting: "SETTING_2", configVersion: 1, plans: [], canRequest: true, featuresUnaffected: true } });
        show();
        const card = await screen.findByRole("region", { name: "Plan" });
        expect(card.textContent).toContain("Choose a plan for your restaurant");
        expect(screen.getByRole("link", { name: "View plans" }).getAttribute("href")).toBe("/b1/admin/account#plan");
    });

    it("shows a pending request or the current plan", async () => {
        get.mockResolvedValue({ data: { visible: true, setting: "SETTING_2", configVersion: 1, plans: [], canRequest: false,
            pendingRequest: { id: "r1", planCode: "MODEL_2", configVersion: 1, requestedAt: "2026-11-01T10:00:00Z", rowVersion: 0, outsideCurrentConfiguration: false } } });
        show();
        expect((await screen.findByRole("region", { name: "Plan" })).textContent).toContain("Request for Model 2 pending");
        cleanup();
        get.mockResolvedValue({ data: { visible: true, setting: "SETTING_2", configVersion: 1, plans: [], canRequest: false,
            current: { planCode: "MODEL_4", status: "ACTIVE", periodEnd: null, sourceLabel: "Manual record, no payment verified", outsideCurrentConfiguration: false } } });
        show();
        expect((await screen.findByRole("region", { name: "Plan" })).textContent).toContain("Model 4 · Active");
    });
});
