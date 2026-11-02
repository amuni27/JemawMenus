// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

// AGF E4-M8 (Q-M8-9): the owner's "Ads" item appears when the restaurant can manage ads (current Model 3, ads enabled) or
// still has ads to view or archive; otherwise (and if the check fails) the owner navigation is unchanged.

vi.mock("../../app/context/AuthContext", () => ({
    useAuth: () => ({ user: { fullName: "Demo Owner", email: "owner@example.com" }, business: { id: "own-biz", name: "Cafe" }, logout: vi.fn() }),
}));
const list = vi.hoisted(() => vi.fn());
vi.mock("../../api/restaurantAdsApi", () => ({ default: { list } }));

const { default: AdminLayout } = await import("./AdminLayout.tsx");

afterEach(() => { cleanup(); list.mockReset(); });

function renderLayout() {
    render(
        <MemoryRouter initialEntries={["/own-biz/admin/menus"]}>
            <Routes>
                <Route path="/:tenantSlug/admin" element={<AdminLayout />}>
                    <Route path="menus" element={<p>Owner menus page</p>} />
                </Route>
            </Routes>
        </MemoryRouter>
    );
}

describe("the owner's Ads navigation item", () => {
    it("appears for a restaurant that can manage ads", async () => {
        list.mockResolvedValue({ data: { canManage: true, nonArchivedCount: 0, ads: [] } });
        renderLayout();
        expect((await screen.findByRole("link", { name: "Ads" })).getAttribute("href")).toBe("/own-biz/admin/ads");
    });

    it("appears when ads remain to view or archive", async () => {
        list.mockResolvedValue({ data: { canManage: false, nonArchivedCount: 2, ads: [] } });
        renderLayout();
        expect(await screen.findByRole("link", { name: "Ads" })).toBeTruthy();
    });

    it("doesn't appear otherwise or when the check fails", async () => {
        list.mockResolvedValue({ data: { canManage: false, nonArchivedCount: 0, ads: [] } });
        renderLayout();
        await waitFor(() => expect(list).toHaveBeenCalled());
        expect(screen.queryByRole("link", { name: "Ads" })).toBeNull();
        cleanup();
        list.mockRejectedValue(new Error("offline"));
        renderLayout();
        await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
        expect(screen.queryByRole("link", { name: "Ads" })).toBeNull();
    });
});
