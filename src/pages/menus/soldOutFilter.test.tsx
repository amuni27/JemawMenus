// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { ToastProvider } from "../../components/ui/ToastContext";

// AGF-S2-09: the dashboard's "N items sold out" link opens the menu's items filtered to sold-out items.

const getMenu = vi.fn();
vi.mock("../../api/menuApi", () => ({ default: { getMenu, listMenuTypes: vi.fn(), updateMenu: vi.fn() } }));
vi.mock("../../app/context/AuthContext", () => ({ useAuth: () => ({ business: { id: "biz-1" } }) }));
vi.mock("../../hooks/useMenus", () => ({ useMenus: () => ({ deleteMenu: vi.fn() }) }));
vi.mock("../../components/menu/ItemModal.tsx", () => ({ default: () => null }));
vi.mock("../../api/categoriesApi.ts", () => ({
    default: { getCategories: vi.fn().mockResolvedValue({ data: [{ id: "c1", menuId: "m1", name: "Mains", sortOrder: 0, active: true }] }),
        reorderCategories: vi.fn(), createCategory: vi.fn(), updateCategory: vi.fn(), deleteCategory: vi.fn() },
}));
const list = vi.fn();
vi.mock("../../api/itemsApi.ts", () => ({ default: { list, reorder: vi.fn(), create: vi.fn(), update: vi.fn(), updateStatus: vi.fn(), remove: vi.fn() } }));

const { default: MenuDetailPage } = await import("./MenuDetailPage.tsx");

const item = (id: string, name: string, status: string, sortOrder: number) =>
    ({ id, menuId: "m1", categoryId: "c1", name, price: 10, ingredients: ["x"], status, sortOrder, createdAt: "", updatedAt: "" });

beforeEach(() => {
    getMenu.mockResolvedValue({ data: { id: "m1", name: "Lunch", isActive: true, visibility: "PUBLIC", currency: "ETB" } });
    list.mockResolvedValue({ data: [item("x", "Tibs", "OUT_OF_STOCK", 0), item("y", "Shiro", "AVAILABLE", 1), item("z", "Kitfo", "UNAVAILABLE", 2)] });
});
afterEach(() => cleanup());

const Where = () => <p data-testid="where">{useLocation().search}</p>;

function renderAt(path: string) {
    render(
        <ToastProvider>
            <MemoryRouter initialEntries={[path]}>
                <Routes><Route path="/:tenantSlug/admin/menus/:menuId" element={<><MenuDetailPage /><Where /></>} /></Routes>
            </MemoryRouter>
        </ToastProvider>
    );
}
const names = () => within(screen.getByRole("list", { name: "Items" })).getAllByRole("listitem").map((li) => li.getAttribute("data-name"));

describe("sold-out filter", () => {
    it("shows only sold-out items when opened from the dashboard link, until 'Show all items'", async () => {
        renderAt("/biz-1/admin/menus/m1?stock=sold-out");
        await screen.findByRole("list", { name: "Items" });
        await waitFor(() => expect(names()).toEqual(["Tibs"]));
        expect(screen.getByText("Showing sold-out items only.")).toBeTruthy();
        // no reordering while filtered
        expect(screen.queryByRole("group", { name: /^Reorder / })).toBeNull();

        fireEvent.click(screen.getByRole("button", { name: "Show all items" }));
        expect(names()).toEqual(["Tibs", "Shiro", "Kitfo"]);
        expect(screen.getByTestId("where").textContent).toBe("");
        expect(screen.queryByText("Showing sold-out items only.")).toBeNull();
    });

    it("shows every item without the filter (unchanged behaviour)", async () => {
        renderAt("/biz-1/admin/menus/m1");
        await screen.findByRole("list", { name: "Items" });
        await waitFor(() => expect(names()).toEqual(["Tibs", "Shiro", "Kitfo"]));
        expect(screen.queryByText("Showing sold-out items only.")).toBeNull();
    });
});
