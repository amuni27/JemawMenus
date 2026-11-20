// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

// AGF FE-2 (register §49 Q8 skippable): while the backend says a plan must be chosen, the page greets the owner with a
// first-time banner and a way to their menus. The choices themselves are unchanged: only what the backend offers.

const get = vi.fn();
vi.mock("../../api/planApi", () => ({ default: { get, request: vi.fn(), withdraw: vi.fn(), activate: vi.fn(), startTrial: vi.fn() } }));
const auth = { value: { user: { email: "owner@cafe.test", emailVerification: { verified: false, available: true, publishGateEnabled: false } }, refresh: vi.fn() } };
vi.mock("../../app/context/AuthContext", () => ({ useAuth: () => auth.value }));

const { default: SubscriptionPlansPage } = await import("./SubscriptionPlansPage.tsx");

function PlansPage() {
    return (
        <MemoryRouter initialEntries={["/biz-1/admin/plans"]}>
            <Routes>
                <Route path="/:tenantSlug/admin/plans" element={<SubscriptionPlansPage />} />
                <Route path="/:tenantSlug/admin/menus" element={<p>Menus page</p>} />
                <Route path="/:tenantSlug/admin" element={<p>Dashboard page</p>} />
            </Routes>
        </MemoryRouter>
    );
}

const plans = [{ code: "MODEL_2", model: "MODEL_2", adSource: "AGAFARI", paid: false }, { code: "MODEL_4", model: "MODEL_4", adSource: "NONE", paid: true }];
const setting2 = (over: Record<string, unknown> = {}) => ({ data: { visible: true, setting: "SETTING_2", configVersion: 3, plans, canRequest: true,
    trialAvailable: false, featuresUnaffected: true, ...over } });

beforeEach(() => get.mockReset());
afterEach(() => cleanup());

describe("Subscription & Plans first-time banner", () => {
    it("welcomes a restaurant that must choose and lets the owner continue to their menus", async () => {
        get.mockResolvedValue(setting2({ selectionRequired: true }));
        render(<PlansPage />);
        const banner = await screen.findByRole("region", { name: "Choose how you'd like to start" });
        expect(banner.textContent).toContain("You can prepare your menus meanwhile.");

        fireEvent.click(within(banner).getByRole("link", { name: "Continue to my menus" }));
        expect(await screen.findByText("Menus page")).toBeTruthy();
    });

    it("still offers only the backend's choices", async () => {
        get.mockResolvedValue(setting2({ selectionRequired: true }));
        render(<PlansPage />);
        await screen.findByRole("region", { name: "Choose how you'd like to start" });
        expect(screen.getAllByRole("button", { name: /request/i }).length).toBeGreaterThan(0);
    });

    it("works the same under Setting 1 for an unverified owner (no trial bypass)", async () => {
        get.mockResolvedValue({ data: { visible: true, setting: "SETTING_1", configVersion: 1, plans: [], featuresUnaffected: true, trialEligible: true,
            selectionRequired: true } });
        render(<PlansPage />);
        const banner = await screen.findByRole("region", { name: "Choose how you'd like to start" });
        expect(within(banner).getByRole("link", { name: "Continue to my menus" })).toBeTruthy();
        expect(screen.queryByRole("dialog")).toBeNull();
    });

    it.each([
        ["not required", { selectionRequired: false }],
        ["absent", {}],
    ])("shows no banner when the signal is %s", async (_label, over) => {
        get.mockResolvedValue(setting2(over));
        render(<PlansPage />);
        await screen.findByRole("region", { name: "Subscription & Plans" });
        expect(screen.queryByRole("region", { name: "Choose how you'd like to start" })).toBeNull();
        expect(screen.queryByRole("link", { name: "Continue to my menus" })).toBeNull();
    });
});
