// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";

// AGF FE-2 (register §49): while the backend says a plan must be chosen, the owner area shows a reminder linking to
// Subscription & Plans (not on that page itself). It can be dismissed for the browser session, never blocks a page, and
// disappears once the backend no longer says so (after a choice, the next page reads the plan again).

vi.mock("../../api/restaurantAdsApi", () => ({ default: { list: () => Promise.resolve({ data: { canManage: false, nonArchivedCount: 0, ads: [] } }) } }));
const get = vi.fn();
vi.mock("../../api/planApi", () => ({ default: { get } }));
vi.mock("../../app/context/AuthContext", () => ({
    useAuth: () => ({
        user: { fullName: "Demo Owner", email: "owner@example.com", emailVerification: { verified: true, available: true, publishGateEnabled: false } },
        business: { id: "own-biz", name: "Cafe" }, logout: vi.fn(), refresh: vi.fn(),
    }),
}));
vi.mock("../../api/emailVerificationApi", () => ({ emailVerificationApi: { resend: vi.fn() } }));

const { default: AdminLayout } = await import("./AdminLayout.tsx");

const REMINDER = "Choose how your restaurant starts on Agafari.";

function Owner({ at = "/own-biz/admin/menus" }: { at?: string }) {
    return (
        <MemoryRouter initialEntries={[at]}>
            <Routes>
                <Route path="/:tenantSlug/admin" element={<AdminLayout />}>
                    <Route path="menus" element={<><p>Owner menus page</p><Link to="/own-biz/admin/qrcode">To QR</Link></>} />
                    <Route path="qrcode" element={<p>QR page</p>} />
                    <Route path="plans" element={<p>Plans page</p>} />
                </Route>
            </Routes>
        </MemoryRouter>
    );
}

const required = (value: boolean | undefined, visible = true) => ({ data: { visible, ...(value === undefined ? {} : { selectionRequired: value }) } });

beforeEach(() => { get.mockReset(); sessionStorage.clear(); });
afterEach(() => cleanup());

describe("AdminLayout plan reminder", () => {
    it("reminds a restaurant that must choose, above the page, with a link to Subscription & Plans", async () => {
        get.mockResolvedValue(required(true));
        render(<Owner />);
        const reminder = await screen.findByRole("status", { name: "Plan reminder" });
        expect(reminder.textContent).toContain(REMINDER);
        expect(screen.getByText("Owner menus page")).toBeTruthy();

        fireEvent.click(screen.getByRole("link", { name: "Go to Subscription & Plans" }));
        expect(await screen.findByText("Plans page")).toBeTruthy();
        expect(screen.queryByRole("status", { name: "Plan reminder" })).toBeNull();
    });

    it("isn't shown on the Subscription & Plans page itself", async () => {
        get.mockResolvedValue(required(true));
        render(<Owner at="/own-biz/admin/plans" />);
        await screen.findByText("Plans page");
        await waitFor(() => expect(get).toHaveBeenCalled());
        expect(screen.queryByRole("status", { name: "Plan reminder" })).toBeNull();
    });

    it.each([
        ["not required", required(false)],
        ["absent", required(undefined)],
        ["plans hidden", required(true, false)],
    ])("isn't shown when the signal is %s", async (_label, res) => {
        get.mockResolvedValue(res);
        render(<Owner />);
        await waitFor(() => expect(get).toHaveBeenCalled());
        await screen.findByText("Owner menus page");
        expect(screen.queryByText(REMINDER)).toBeNull();
    });

    it("isn't shown when the plan can't be read", async () => {
        get.mockRejectedValue(new Error("network"));
        render(<Owner />);
        await waitFor(() => expect(get).toHaveBeenCalled());
        expect(screen.queryByText(REMINDER)).toBeNull();
        expect(screen.getByText("Owner menus page")).toBeTruthy();
    });

    it("can be dismissed for the session", async () => {
        get.mockResolvedValue(required(true));
        render(<Owner />);
        await screen.findByRole("status", { name: "Plan reminder" });
        fireEvent.click(screen.getByRole("button", { name: "Dismiss plan reminder" }));
        expect(screen.queryByText(REMINDER)).toBeNull();

        cleanup();
        render(<Owner />);
        await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
        await screen.findByText("Owner menus page");
        expect(screen.queryByText(REMINDER)).toBeNull();
    });

    it("disappears on the next page once the backend no longer requires a choice", async () => {
        get.mockResolvedValue(required(true));
        render(<Owner />);
        await screen.findByRole("status", { name: "Plan reminder" });

        get.mockResolvedValue(required(false));
        fireEvent.click(screen.getByRole("link", { name: "To QR" }));
        await screen.findByText("QR page");
        await waitFor(() => expect(screen.queryByText(REMINDER)).toBeNull());
    });

    it("doesn't read the plan again on every page when no choice is required", async () => {
        get.mockResolvedValue(required(false));
        render(<Owner />);
        await waitFor(() => expect(get).toHaveBeenCalledTimes(1));
        fireEvent.click(screen.getByRole("link", { name: "To QR" }));
        await screen.findByText("QR page");
        expect(get).toHaveBeenCalledTimes(1);
    });
});
