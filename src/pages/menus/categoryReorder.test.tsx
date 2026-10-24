// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ToastProvider } from "../../components/ui/ToastContext";

// AGF-S2-07: owners reorder categories; the full new order is saved, and restored if saving fails.
// Since the S2-07A correction the drag handle is the only control, so these cases use keyboard dragging
// (Space to pick up, arrows to move, Space to drop); the mouse and touch paths are in categoryDragDrop.test.tsx.

const getMenu = vi.fn();
vi.mock("../../api/menuApi", () => ({ default: { getMenu, listMenuTypes: vi.fn(), updateMenu: vi.fn() } }));
vi.mock("../../app/context/AuthContext", () => ({ useAuth: () => ({ business: { id: "biz-1" } }) }));
vi.mock("../../hooks/useMenus", () => ({ useMenus: () => ({ deleteMenu: vi.fn() }) }));
vi.mock("../../hooks/useItems.ts", () => ({ useItems: () => ({ items: [] }) }));
vi.mock("../../components/menu/ItemsPanel.tsx", () => ({ default: () => null }));
vi.mock("../../components/menu/ItemModal.tsx", () => ({ default: () => null }));

const getCategories = vi.fn();
const reorderCategories = vi.fn();
const createCategory = vi.fn();
vi.mock("../../api/categoriesApi.ts", () => ({
    default: { getCategories, reorderCategories, createCategory, updateCategory: vi.fn(), deleteCategory: vi.fn() },
}));

const { default: MenuDetailPage } = await import("./MenuDetailPage.tsx");

// jsdom has no layout: give each category row a box so keyboard moves can find the next position
const originalRect = Element.prototype.getBoundingClientRect;
beforeAll(() => {
    Element.prototype.getBoundingClientRect = function () {
        const index = (this as HTMLElement).closest?.("[data-index]")?.getAttribute("data-index");
        if (index == null) return originalRect.call(this);
        const top = Number(index) * 50;
        return { x: 0, y: top, top, left: 0, right: 300, bottom: top + 40, width: 300, height: 40, toJSON: () => ({}) } as DOMRect;
    };
});
afterAll(() => { Element.prototype.getBoundingClientRect = originalRect; });

const cat = (id: string, name: string, sortOrder: number, active = true) =>
    ({ id, menuId: "m1", name, sortOrder, active, isActive: active, createdAt: "", updatedAt: "" });

beforeEach(() => {
    [getMenu, getCategories, reorderCategories, createCategory].forEach((m) => m.mockReset());
    getMenu.mockResolvedValue({ data: { id: "m1", name: "Lunch", isActive: true, visibility: "PUBLIC", currency: "ETB" } });
    reorderCategories.mockResolvedValue({ data: { success: true } });
});
afterEach(() => cleanup());

async function renderPage(categories: unknown[]) {
    getCategories.mockResolvedValue({ data: categories });
    render(
        <ToastProvider>
            <MemoryRouter initialEntries={["/biz-1/admin/menus/m1"]}>
                <Routes><Route path="/:tenantSlug/admin/menus/:menuId" element={<MenuDetailPage />} /></Routes>
            </MemoryRouter>
        </ToastProvider>
    );
    await screen.findByRole("heading", { name: "Categories" });
    if ((categories as unknown[]).length) await screen.findByRole("list", { name: "Categories" });
}

const list = () => screen.getByRole("list", { name: "Categories" });
const order = () => within(list()).getAllByRole("listitem").map((li) => li.getAttribute("data-name"));
const handle = (name: string) => screen.getByRole("button", { name: `Drag ${name} to reorder` });

async function press(el: Element, code: string) {
    await act(async () => { fireEvent.keyDown(el, { code, key: code === "Space" ? " " : code }); });
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); }); // dnd-kit measures after pick-up
}

/** Keyboard drag: focus the handle, Space, the arrow keys, Space. */
async function keyboardMove(name: string, ...arrows: ("ArrowUp" | "ArrowDown")[]) {
    const h = handle(name);
    h.focus();
    await press(h, "Space");
    for (const a of arrows) await press(h, a);
    await press(h, "Space");
}

const ABC = [cat("a", "Starters", 0), cat("b", "Mains", 1), cat("c", "Drinks", 2)];

describe("category reordering", () => {
    it("has no up/down arrow buttons; the drag handle is the control", async () => {
        await renderPage(ABC);
        expect(screen.queryByRole("button", { name: /^Move .* (up|down)$/ })).toBeNull();
        expect(handle("Starters")).toBeTruthy();
    });

    it("moves Drinks to the top and saves the full order each time (AC1)", async () => {
        await renderPage(ABC);
        expect(order()).toEqual(["Starters", "Mains", "Drinks"]);

        await keyboardMove("Drinks", "ArrowUp", "ArrowUp");
        await waitFor(() => expect(reorderCategories).toHaveBeenLastCalledWith("m1", ["c", "a", "b"]));
        expect(reorderCategories).toHaveBeenCalledTimes(1);
        expect(order()).toEqual(["Drinks", "Starters", "Mains"]);

        await keyboardMove("Starters", "ArrowDown");
        await waitFor(() => expect(reorderCategories).toHaveBeenLastCalledWith("m1", ["c", "b", "a"]));
    });

    it("restores the original order and shows the error when saving fails (AC2)", async () => {
        reorderCategories.mockRejectedValue({ response: { status: 400, data: { message: "orderedIds must list every category of this menu exactly once" } } });
        await renderPage(ABC);

        await keyboardMove("Drinks", "ArrowUp");
        expect(await screen.findByRole("alert")).toHaveProperty("textContent",
            "Couldn't save the new order: orderedIds must list every category of this menu exactly once");
        expect(order()).toEqual(["Starters", "Mains", "Drinks"]);
    });

    it("saves nothing when moving past the ends", async () => {
        await renderPage(ABC);
        await keyboardMove("Starters", "ArrowUp");
        await keyboardMove("Drinks", "ArrowDown");
        expect(order()).toEqual(["Starters", "Mains", "Drinks"]);
        expect(reorderCategories).not.toHaveBeenCalled();
    });

    it("blocks another reorder while one is saving", async () => {
        let finish: (v: unknown) => void = () => {};
        reorderCategories.mockImplementation(() => new Promise((r) => { finish = r; }));
        await renderPage(ABC);

        await keyboardMove("Mains", "ArrowUp");
        expect(handle("Drinks").getAttribute("aria-disabled")).toBe("true");
        await keyboardMove("Drinks", "ArrowUp");
        expect(reorderCategories).toHaveBeenCalledTimes(1);

        await act(async () => finish({ data: { success: true } }));
        await waitFor(() => expect(handle("Drinks").getAttribute("aria-disabled")).toBe("false"));
    });

    it("keeps a single category in place and shows no list for an empty menu", async () => {
        await renderPage([cat("a", "Only", 0)]);
        await keyboardMove("Only", "ArrowUp", "ArrowDown");
        expect(reorderCategories).not.toHaveBeenCalled();
        cleanup();

        await renderPage([]);
        expect(await screen.findByText("No categories yet.")).toBeTruthy();
        expect(screen.queryByRole("button", { name: /^Drag / })).toBeNull();
    });

    it("lets hidden categories be reordered and keeps them marked Hidden (AC3)", async () => {
        await renderPage([cat("a", "Starters", 0), cat("b", "Secret", 1, false), cat("c", "Drinks", 2)]);
        await keyboardMove("Secret", "ArrowUp");
        await waitFor(() => expect(reorderCategories).toHaveBeenLastCalledWith("m1", ["b", "a", "c"]));
        const first = within(list()).getAllByRole("listitem")[0];
        expect(within(first).getByText("Hidden")).toBeTruthy();
    });

    it("shows the categories in their saved order on load", async () => {
        await renderPage([cat("c", "Drinks", 0), cat("a", "Starters", 1), cat("b", "Mains", 2)]);
        expect(order()).toEqual(["Drinks", "Starters", "Mains"]);
    });

    it("adds a new category at the end, where it is saved", async () => {
        createCategory.mockResolvedValue({ data: cat("d", "Desserts", 3) });
        await renderPage(ABC);

        fireEvent.click(screen.getAllByRole("button", { name: "+ Add Category" })[0]);
        await screen.findByText("Create category");
        fireEvent.change(screen.getByRole("textbox"), { target: { value: "Desserts" } });
        fireEvent.click(screen.getByRole("button", { name: "Create" }));

        await waitFor(() => expect(order()).toEqual(["Starters", "Mains", "Drinks", "Desserts"]));
    });
});
