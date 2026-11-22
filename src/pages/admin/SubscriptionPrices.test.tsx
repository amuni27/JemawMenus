// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

// AGF F2 (register §84 D1, D3): paid plans show the backend's prices (amount, currency, interval) when the backend lists them
// (prices-visible); no price is ever invented or shown for a free plan; no tax wording (AD-16). Without prices the page keeps
// "Pricing will be announced"; the request note stays only while a paid plan is still requested.

const get = vi.fn();
vi.mock("../../api/planApi", () => ({ default: { get, request: vi.fn(), withdraw: vi.fn(), activate: vi.fn(), startTrial: vi.fn(), openCardUpdate: vi.fn(),
    notices: vi.fn(() => Promise.resolve({ data: [] })), readNotice: vi.fn() } }));
const auth = { value: { user: { email: "owner@cafe.test", emailVerification: { verified: true, available: true, publishGateEnabled: false } }, refresh: vi.fn() } };
vi.mock("../../app/context/AuthContext", () => ({ useAuth: () => auth.value }));

const { default: SubscriptionPlansPage } = await import("./SubscriptionPlansPage.tsx");

function PlansPage() {
    return (
        <MemoryRouter initialEntries={["/biz-1/admin/plans"]}>
            <Routes><Route path="/:tenantSlug/admin/plans" element={<SubscriptionPlansPage />} /></Routes>
        </MemoryRouter>
    );
}

const plans = [{ code: "MODEL_2", model: "MODEL_2", adSource: "AGAFARI", paid: false }, { code: "MODEL_3", model: "MODEL_3", adSource: "RESTAURANT", paid: true },
    { code: "MODEL_4", model: "MODEL_4", adSource: "NONE", paid: true }];
const view = (over: Record<string, unknown> = {}) => ({ data: { visible: true, setting: "SETTING_2", configVersion: 3, plans, canRequest: true, featuresUnaffected: true, ...over } });
const card = async (name: RegExp) => (await screen.findAllByRole("article")).find((a) => name.test(within(a).getByRole("heading").textContent ?? ""))!;

beforeEach(() => get.mockReset());
afterEach(() => cleanup());

describe("paid plan prices (F2)", () => {
    it("shows each listed price of a paid plan with its currency and interval, and none on the free plan", async () => {
        get.mockResolvedValue(view({ prices: [
            { id: "p-m4-month", planCode: "MODEL_4", interval: "MONTH", currency: "USD", amountMinor: 2500 },
            { id: "p-m4-year", planCode: "MODEL_4", interval: "YEAR", currency: "USD", amountMinor: 25000 },
            { id: "p-m3-month", planCode: "MODEL_3", interval: "MONTH", currency: "USD", amountMinor: 1500 },
        ] }));
        render(<PlansPage />);
        const m4 = await card(/Ad-Free|Model 4/);
        expect(within(m4).getByText("$25.00 per month")).toBeTruthy();
        expect(within(m4).getByText("$250.00 per year")).toBeTruthy();
        expect(within(await card(/Business Ads/)).getByText("$15.00 per month")).toBeTruthy();
        expect((await card(/Free with Ads|Model 2/)).textContent).not.toMatch(/\$|per month|per year/);
        expect(screen.queryByText("Pricing will be announced.")).toBeNull();
        expect(document.body.textContent).not.toMatch(/tax/i);
    });

    it("uses the price's own currency", async () => {
        get.mockResolvedValue(view({ prices: [{ id: "p-et", planCode: "MODEL_4", interval: "MONTH", currency: "ETB", amountMinor: 250000 }] }));
        render(<PlansPage />);
        expect(within(await card(/Ad-Free|Model 4/)).getByText(/2,500\.00 per month/)).toBeTruthy();
    });

    it("keeps 'Pricing will be announced' and shows no price while the backend lists none", async () => {
        get.mockResolvedValue(view());
        render(<PlansPage />);
        await card(/Ad-Free|Model 4/);
        expect(screen.getByText("Pricing will be announced.")).toBeTruthy();
        expect(document.body.textContent).not.toMatch(/per month|per year/);
    });

    it("never shows a price for a plan the backend didn't list", async () => {
        get.mockResolvedValue(view({ prices: [{ id: "p-m4", planCode: "MODEL_4", interval: "MONTH", currency: "USD", amountMinor: 2500 }] }));
        render(<PlansPage />);
        const m3 = await card(/Business Ads/);
        expect(m3.textContent).not.toMatch(/per month|per year/);
        expect(within(m3).getByText("Price to be announced")).toBeTruthy();
    });

    it("shows the price with 'Payment not available yet' and no Request while checkout isn't available (AGF F5)", async () => {
        get.mockResolvedValue(view({ prices: [{ id: "p-m4", planCode: "MODEL_4", interval: "MONTH", currency: "USD", amountMinor: 2500 }] }));
        render(<PlansPage />);
        const m4 = await card(/Ad-Free|Model 4/);
        expect(m4.textContent).toContain("$25.00 per month");
        expect(within(m4).getByText("Payment not available yet")).toBeTruthy();
        expect(within(m4).queryByRole("button")).toBeNull();
    });
});
