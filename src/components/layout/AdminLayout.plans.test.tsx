// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

// ONB Phase 1 (UX-AC1): a top-level "Subscription & Plans" item appears in the owner navigation while the owner plan view
// is visible (owner-plans-visible); otherwise, and if the check fails, the navigation is unchanged.

vi.mock("../../app/context/AuthContext", () => ({
    useAuth: () => ({ user: { fullName: "Demo Owner", email: "owner@example.com" }, business: { id: "own-biz", name: "Cafe" }, logout: vi.fn() }),
}));
vi.mock("../../api/restaurantAdsApi", () => ({ default: { list: () => Promise.resolve({ data: { canManage: false, nonArchivedCount: 0, ads: [] } }) } }));
const get = vi.hoisted(() => vi.fn());
vi.mock("../../api/planApi", () => ({ default: { get } }));

const { default: AdminLayout } = await import("./AdminLayout.tsx");

afterEach(() => { cleanup(); get.mockReset(); });

function renderLayout() {
    render(
        <MemoryRouter initialEntries={["/own-biz/admin/plans"]}>
            <Routes>
                <Route path="/:tenantSlug/admin" element={<AdminLayout />}>
                    <Route path="plans" element={<p>Plans page</p>} />
                </Route>
            </Routes>
        </MemoryRouter>
    );
    return screen.getByRole("navigation");
}

describe("the owner's Subscription & Plans navigation item", () => {
    it("appears, last and current on its page, while plans are visible", async () => {
        get.mockResolvedValue({ data: { visible: true, setting: "SETTING_2" } });
        const nav = renderLayout();
        const link = await within(nav).findByRole("link", { name: "Subscription & Plans" });
        expect(link.getAttribute("href")).toBe("/own-biz/admin/plans");
        expect(link.getAttribute("aria-current")).toBe("page");
        expect(within(nav).getAllByRole("link").at(-1)).toBe(link);
    });

    it("doesn't appear while plans aren't visible or when the check fails", async () => {
        get.mockResolvedValue({ data: { visible: false } });
        let nav = renderLayout();
        await waitFor(() => expect(get).toHaveBeenCalled());
        expect(within(nav).queryByRole("link", { name: "Subscription & Plans" })).toBeNull();
        cleanup();
        get.mockRejectedValue(new Error("offline"));
        nav = renderLayout();
        await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
        expect(within(nav).queryByRole("link", { name: "Subscription & Plans" })).toBeNull();
    });
});
