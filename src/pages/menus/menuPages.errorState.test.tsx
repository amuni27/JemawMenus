// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

// AGF-S1-11: owner menu pages show an error and a Retry button instead of loading forever.

const listMenus = vi.fn();
const getMenu = vi.fn();
vi.mock("../../api/menuApi", () => ({ default: { listMenus, getMenu, updateMenu: vi.fn() } }));
vi.mock("../../app/context/AuthContext", () => ({ useAuth: () => ({ business: { id: "biz-1" } }) }));
vi.mock("../../hooks/useMenus", () => ({ useMenus: () => ({ deleteMenu: vi.fn() }) }));
vi.mock("../../hooks/useCategories", () => ({ useCategories: () => ({ categories: [], loading: false }) }));
vi.mock("../../hooks/useItems.ts", () => ({ useItems: () => ({ items: [] }) }));
vi.mock("../../components/menu/CategoryPanel.tsx", () => ({ default: () => null }));
vi.mock("../../components/menu/ItemsPanel.tsx", () => ({ default: () => null }));
vi.mock("../../components/menu/CategoryModal.tsx", () => ({ default: () => null }));
vi.mock("../../components/menu/ItemModal.tsx", () => ({ default: () => null }));
vi.mock("./MenuWizard", () => ({ default: () => <p>Menu wizard</p> }));

const { default: MenusListPage } = await import("./MenusListPage.tsx");
const { default: MenuDetailPage } = await import("./MenuDetailPage.tsx");
const { default: MenuEditPage } = await import("./MenuEditPage.tsx");

const networkError = Object.assign(new Error("Network Error"), { code: "ERR_NETWORK" });
const MENU = { id: "m1", name: "All-Day Menu", businessId: "biz-1", menuType: { id: "t1", name: "Lunch" } };

function renderAt(path: string) {
    render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path="/:tenantSlug/admin/menus" element={<MenusListPage />} />
                <Route path="/:tenantSlug/admin/menus/:menuId" element={<MenuDetailPage />} />
                <Route path="/:tenantSlug/admin/menus/:menuId/edit" element={<MenuEditPage />} />
            </Routes>
        </MemoryRouter>
    );
}

describe("owner menu pages error state", () => {
    beforeEach(() => {
        listMenus.mockReset();
        getMenu.mockReset();
    });
    afterEach(() => cleanup());

    it("menus list: shows an error and Retry, then loads on retry", async () => {
        listMenus.mockRejectedValueOnce(networkError).mockResolvedValueOnce({ status: 200, data: [MENU] });
        renderAt("/biz-1/admin/menus");

        expect((await screen.findByRole("alert")).textContent).toContain("Could not reach the server");
        expect(screen.queryByText("Loading...")).toBeNull();

        fireEvent.click(screen.getByRole("button", { name: "Retry" }));
        expect((await screen.findAllByText("All-Day Menu")).length).toBeGreaterThan(0);
        expect(listMenus).toHaveBeenCalledTimes(2);
    });

    it("menu detail: shows the server message and Retry", async () => {
        getMenu.mockRejectedValueOnce({ response: { status: 500, data: { message: "An unexpected error occurred" } } })
            .mockResolvedValueOnce({ data: MENU });
        renderAt("/biz-1/admin/menus/m1");

        expect((await screen.findByRole("alert")).textContent).toContain("An unexpected error occurred");
        fireEvent.click(screen.getByRole("button", { name: "Retry" }));
        expect(await screen.findByText("All-Day Menu", { selector: "span" })).toBeTruthy();
    });

    it("menu edit: shows an error and Retry", async () => {
        getMenu.mockRejectedValueOnce(networkError).mockResolvedValueOnce({ data: MENU });
        renderAt("/biz-1/admin/menus/m1/edit");

        expect((await screen.findByRole("alert")).textContent).toContain("Could not reach the server");
        fireEvent.click(screen.getByRole("button", { name: "Retry" }));
        expect(await screen.findByText("Menu wizard")).toBeTruthy();
    });
});
