// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ToastProvider } from "../../components/ui/ToastContext";

// AGF-S2-08: with a category chosen in the items panel, owners reorder its items; the full order of that
// category is saved, one reorder at a time, and restored if saving fails. Since AGF-S2-08A the cards are dragged
// (no Earlier / Later buttons), so these cases use keyboard dragging; mouse, touch and grid cases are in
// itemDragDrop.test.tsx.

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

// jsdom has no layout: one card per row (so ArrowUp / ArrowDown move one place)
const originalRect = Element.prototype.getBoundingClientRect;
beforeAll(() => {
    Element.prototype.getBoundingClientRect = function () {
        const index = (this as HTMLElement).closest?.("[data-item-index]")?.getAttribute("data-item-index");
        if (index == null) return originalRect.call(this);
        const top = Number(index) * 300;
        return { x: 0, y: top, left: 0, top, right: 200, bottom: top + 280, width: 200, height: 280, toJSON: () => ({}) } as DOMRect;
    };
});
afterAll(() => { Element.prototype.getBoundingClientRect = originalRect; });

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
const card = (name: string) => screen.getByRole("group", { name: `Reorder ${name}` });

async function press(el: Element, code: string) {
    await act(async () => { fireEvent.keyDown(el, { code, key: code === "Space" ? " " : code }); });
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
}
/** Keyboard drag on a card: focus, Space, arrows, Space. */
async function keyboardMove(name: string, ...arrows: ("ArrowUp" | "ArrowDown")[]) {
    const c = card(name);
    c.focus();
    await press(c, "Space");
    for (const a of arrows) await press(c, a);
    await press(c, "Space");
}

describe("item reordering", () => {
    it("offers reordering only with one category chosen", async () => {
        await renderPage();
        expect(order()).toEqual(["X Tibs", "Y Shiro", "Z Kitfo", "Tea"]);
        expect(screen.queryByRole("group", { name: /^Reorder / })).toBeNull();
        expect(screen.getByText("Choose a category to change the order of its items.")).toBeTruthy();
        // categories listed in their saved order
        expect(within(categoryFilter()).getAllByRole("option").map((o) => o.textContent)).toEqual(["All categories", "Mains", "Drinks"]);
    });

    it("moves Z first and saves the category's full order each time (AC1)", async () => {
        await renderPage();
        choose("Mains");
        expect(order()).toEqual(["X Tibs", "Y Shiro", "Z Kitfo"]);

        await keyboardMove("Z Kitfo", "ArrowUp");
        await waitFor(() => expect(reorder).toHaveBeenLastCalledWith("c1", ["x", "z", "y"]));
        await keyboardMove("Z Kitfo", "ArrowUp");
        await waitFor(() => expect(reorder).toHaveBeenLastCalledWith("c1", ["z", "x", "y"]));
        expect(order()).toEqual(["Z Kitfo", "X Tibs", "Y Shiro"]);

        choose("All categories");
        expect(order()).toEqual(["Z Kitfo", "X Tibs", "Y Shiro", "Tea"]);
    });

    it("restores the order and explains why when saving fails", async () => {
        reorder.mockRejectedValue({ response: { status: 400, data: { message: "orderedIds must list every item of this category exactly once" } } });
        await renderPage();
        choose("Mains");

        await keyboardMove("Y Shiro", "ArrowDown");
        expect((await screen.findByRole("alert")).textContent)
            .toBe("Couldn't save the new order: orderedIds must list every item of this category exactly once");
        expect(order()).toEqual(["X Tibs", "Y Shiro", "Z Kitfo"]);
    });

    it("shows saving, and ignores other reorders until the save finishes", async () => {
        let finish: (v: unknown) => void = () => {};
        reorder.mockImplementation(() => new Promise((r) => { finish = r; }));
        await renderPage();
        choose("Mains");

        await keyboardMove("Y Shiro", "ArrowUp");
        // the category list's drag-and-drop live region is a status too (S2-07A), so find this one by text
        expect(screen.getByText("Saving order…").getAttribute("role")).toBe("status");
        expect(card("Z Kitfo").getAttribute("aria-disabled")).toBe("true");
        await keyboardMove("Z Kitfo", "ArrowUp");
        expect(reorder).toHaveBeenCalledTimes(1);

        await act(async () => finish({ data: { success: true } }));
        await waitFor(() => expect(screen.queryByText("Saving order…")).toBeNull());
        expect(card("Z Kitfo").getAttribute("aria-disabled")).toBe("false");
    });

    it("saves nothing when moving past the ends, or for a single item", async () => {
        await renderPage();
        choose("Mains");
        await keyboardMove("X Tibs", "ArrowUp");
        await keyboardMove("Z Kitfo", "ArrowDown");

        choose("Drinks");
        await keyboardMove("Tea", "ArrowUp", "ArrowDown");
        expect(reorder).not.toHaveBeenCalled();
    });

    it("turns reordering off while searching", async () => {
        await renderPage();
        choose("Mains");
        fireEvent.change(screen.getByPlaceholderText("Search items"), { target: { value: "tibs" } });
        expect(order()).toEqual(["X Tibs"]);
        expect(screen.queryByRole("group", { name: /^Reorder / })).toBeNull();
        expect(screen.getByText("Clear the search to change the order.")).toBeTruthy();
    });

    it("includes hidden and sold-out items, which keep their status", async () => {
        await renderPage([item("x", "X Tibs", "c1", 0), item("y", "Y Shiro", "c1", 1, "UNAVAILABLE"), item("z", "Z Kitfo", "c1", 2, "OUT_OF_STOCK")]);
        choose("Mains");
        await keyboardMove("Z Kitfo", "ArrowUp");
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
