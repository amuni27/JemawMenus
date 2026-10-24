// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ToastProvider } from "../../components/ui/ToastContext";

// AGF-S2-08: with a category chosen in the items panel, owners move items earlier or later; the full order of
// that category is saved, one move at a time, and restored if saving fails.

const getMenu = vi.fn();
vi.mock("../../api/menuApi", () => ({ default: { getMenu, listMenuTypes: vi.fn(), updateMenu: vi.fn() } }));
vi.mock("../../app/context/AuthContext", () => ({ useAuth: () => ({ business: { id: "biz-1" } }) }));
vi.mock("../../hooks/useMenus", () => ({ useMenus: () => ({ deleteMenu: vi.fn() }) }));
vi.mock("../../components/menu/ItemModal.tsx", () => ({ default: () => null }));

const getCategories = vi.fn();
vi.mock("../../api/categoriesApi.ts", () => ({
    default: { getCategories, reorderCategories: vi.fn(), createCategory: vi.fn(), updateCategory: vi.fn(), deleteCategory: vi.fn() },
}));

const list = vi.fn();
const reorder = vi.fn();
vi.mock("../../api/itemsApi.ts", () => ({ default: { list, reorder, create: vi.fn(), update: vi.fn(), updateStatus: vi.fn(), delete: vi.fn() } }));

const { default: MenuDetailPage } = await import("./MenuDetailPage.tsx");

const cat = (id: string, name: string, sortOrder: number) =>
    ({ id, menuId: "m1", name, sortOrder, active: true, isActive: true, createdAt: "", updatedAt: "" });
const item = (id: string, name: string, categoryId: string, sortOrder: number, status = "AVAILABLE") =>
    ({ id, menuId: "m1", categoryId, name, price: 100, ingredients: ["x"], status, sortOrder, createdAt: "", updatedAt: "" });

const CATS = [cat("c1", "Mains", 0), cat("c2", "Drinks", 1)];
const ITEMS = [
    item("x", "X Tibs", "c1", 0), item("y", "Y Shiro", "c1", 1), item("z", "Z Kitfo", "c1", 2), item("t", "Tea", "c2", 0),
];

beforeEach(() => {
    [getMenu, getCategories, list, reorder].forEach((m) => m.mockReset());
    getMenu.mockResolvedValue({ data: { id: "m1", name: "Lunch", isActive: true, visibility: "PUBLIC", currency: "ETB" } });
    getCategories.mockResolvedValue({ data: CATS });
    reorder.mockResolvedValue({ data: { success: true } });
});
afterEach(() => cleanup());

async function renderPage(items: unknown[] = ITEMS) {
    list.mockResolvedValue({ data: items });
    render(
        <ToastProvider>
            <MemoryRouter initialEntries={["/biz-1/admin/menus/m1"]}>
                <Routes><Route path="/:tenantSlug/admin/menus/:menuId" element={<MenuDetailPage />} /></Routes>
            </MemoryRouter>
        </ToastProvider>
    );
    await screen.findByRole("list", { name: "Items" });
    await waitFor(() => expect(within(categoryFilter()).getAllByRole("option").length).toBeGreaterThan(1));
}

const categoryFilter = () => screen.getByLabelText("Category") as HTMLSelectElement;
const choose = (name: string) => {
    const option = within(categoryFilter()).getByRole("option", { name }) as HTMLOptionElement;
    fireEvent.change(categoryFilter(), { target: { value: option.value } });
};
const order = () => within(screen.getByRole("list", { name: "Items" })).getAllByRole("listitem").map((li) => li.getAttribute("data-name"));
const button = (name: string) => screen.getByRole("button", { name }) as HTMLButtonElement;

describe("item reordering", () => {
    it("offers moves only with one category chosen", async () => {
        await renderPage();
        expect(order()).toEqual(["X Tibs", "Y Shiro", "Z Kitfo", "Tea"]);
        expect(screen.queryByRole("button", { name: /^Move .* (earlier|later)$/ })).toBeNull();
        expect(screen.getByText("Choose a category to change the order of its items.")).toBeTruthy();
        // categories listed in their saved order
        expect(within(categoryFilter()).getAllByRole("option").map((o) => o.textContent)).toEqual(["All categories", "Mains", "Drinks"]);
    });

    it("moves Z first and saves the category's full order each time (AC1)", async () => {
        await renderPage();
        choose("Mains");
        expect(order()).toEqual(["X Tibs", "Y Shiro", "Z Kitfo"]);

        fireEvent.click(button("Move Z Kitfo earlier"));
        expect(order()).toEqual(["X Tibs", "Z Kitfo", "Y Shiro"]); // shown at once
        await waitFor(() => expect(reorder).toHaveBeenLastCalledWith("c1", ["x", "z", "y"]));
        await waitFor(() => expect(button("Move Z Kitfo earlier").disabled).toBe(false));

        fireEvent.click(button("Move Z Kitfo earlier"));
        await waitFor(() => expect(reorder).toHaveBeenLastCalledWith("c1", ["z", "x", "y"]));
        expect(order()).toEqual(["Z Kitfo", "X Tibs", "Y Shiro"]);

        choose("All categories");
        expect(order()).toEqual(["Z Kitfo", "X Tibs", "Y Shiro", "Tea"]);
    });

    it("restores the order and explains why when saving fails", async () => {
        reorder.mockRejectedValue({ response: { status: 400, data: { message: "orderedIds must list every item of this category exactly once" } } });
        await renderPage();
        choose("Mains");

        fireEvent.click(button("Move Y Shiro later"));
        expect((await screen.findByRole("alert")).textContent)
            .toBe("Couldn't save the new order: orderedIds must list every item of this category exactly once");
        expect(order()).toEqual(["X Tibs", "Y Shiro", "Z Kitfo"]);
    });

    it("shows saving, and ignores other moves until the save finishes", async () => {
        let finish: (v: unknown) => void = () => {};
        reorder.mockImplementation(() => new Promise((r) => { finish = r; }));
        await renderPage();
        choose("Mains");

        fireEvent.click(button("Move Y Shiro earlier"));
        expect(screen.getByRole("status").textContent).toBe("Saving order…");
        expect(button("Move Z Kitfo earlier").disabled).toBe(true);
        fireEvent.click(button("Move Z Kitfo earlier"));
        expect(reorder).toHaveBeenCalledTimes(1);

        finish({ data: { success: true } });
        await waitFor(() => expect(screen.queryByText("Saving order…")).toBeNull());
        expect(button("Move Z Kitfo earlier").disabled).toBe(false);
    });

    it("disables moves past the ends, and for a single item", async () => {
        await renderPage();
        choose("Mains");
        expect(button("Move X Tibs earlier").disabled).toBe(true);
        expect(button("Move Z Kitfo later").disabled).toBe(true);
        expect(button("Move Y Shiro earlier").disabled).toBe(false);

        choose("Drinks");
        expect(button("Move Tea earlier").disabled).toBe(true);
        expect(button("Move Tea later").disabled).toBe(true);
    });

    it("hides moves while searching", async () => {
        await renderPage();
        choose("Mains");
        fireEvent.change(screen.getByPlaceholderText("Search items"), { target: { value: "tibs" } });
        expect(order()).toEqual(["X Tibs"]);
        expect(screen.queryByRole("button", { name: /^Move .* (earlier|later)$/ })).toBeNull();
        expect(screen.getByText("Clear the search to change the order.")).toBeTruthy();
    });

    it("includes hidden and sold-out items, which keep their status", async () => {
        await renderPage([item("x", "X Tibs", "c1", 0), item("y", "Y Shiro", "c1", 1, "UNAVAILABLE"), item("z", "Z Kitfo", "c1", 2, "OUT_OF_STOCK")]);
        choose("Mains");
        fireEvent.click(button("Move Z Kitfo earlier"));
        await waitFor(() => expect(reorder).toHaveBeenLastCalledWith("c1", ["x", "z", "y"]));
        const cards = within(screen.getByRole("list", { name: "Items" })).getAllByRole("listitem");
        expect(within(cards[1]).getByText(/sold out/i)).toBeTruthy();
    });

    it("shows a category's items by saved position, so new and moved-in items appear last", async () => {
        // e.g. W was just created (position 3) and Tea was moved in from Drinks (position 4)
        await renderPage([item("w", "W Wat", "c1", 3), item("x", "X Tibs", "c1", 0), item("t", "Tea", "c1", 4),
            item("y", "Y Shiro", "c1", 1), item("z", "Z Kitfo", "c1", 2)]);
        choose("Mains");
        expect(order()).toEqual(["X Tibs", "Y Shiro", "Z Kitfo", "W Wat", "Tea"]);
    });
});
