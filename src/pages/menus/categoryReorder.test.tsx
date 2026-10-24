// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ToastProvider } from "../../components/ui/ToastContext";

// AGF-S2-07: owners move categories up and down; the full new order is saved, and restored if saving fails.

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
const button = (name: string) => screen.getByRole("button", { name }) as HTMLButtonElement;

const ABC = [cat("a", "Starters", 0), cat("b", "Mains", 1), cat("c", "Drinks", 2)];

describe("category reordering", () => {
    it("moves Drinks to the top and saves the full order each time (AC1)", async () => {
        await renderPage(ABC);
        expect(order()).toEqual(["Starters", "Mains", "Drinks"]);

        fireEvent.click(button("Move Drinks up"));
        expect(order()).toEqual(["Starters", "Drinks", "Mains"]); // shown at once
        await waitFor(() => expect(reorderCategories).toHaveBeenLastCalledWith("m1", ["a", "c", "b"]));
        await waitFor(() => expect(button("Move Drinks up").disabled).toBe(false));

        fireEvent.click(button("Move Drinks up"));
        await waitFor(() => expect(reorderCategories).toHaveBeenLastCalledWith("m1", ["c", "a", "b"]));
        expect(order()).toEqual(["Drinks", "Starters", "Mains"]);

        fireEvent.click(button("Move Starters down"));
        await waitFor(() => expect(reorderCategories).toHaveBeenLastCalledWith("m1", ["c", "b", "a"]));
    });

    it("restores the original order and shows the error when saving fails (AC2)", async () => {
        reorderCategories.mockRejectedValue({ response: { status: 400, data: { message: "orderedIds must list every category of this menu exactly once" } } });
        await renderPage(ABC);

        fireEvent.click(button("Move Drinks up"));
        expect(await screen.findByRole("alert")).toHaveProperty("textContent",
            "Couldn't save the new order: orderedIds must list every category of this menu exactly once");
        expect(order()).toEqual(["Starters", "Mains", "Drinks"]);
    });

    it("disables moves past the ends and while a move is saving", async () => {
        let finish: (v: unknown) => void = () => {};
        reorderCategories.mockImplementation(() => new Promise((r) => { finish = r; }));
        await renderPage(ABC);

        expect(button("Move Starters up").disabled).toBe(true);
        expect(button("Move Drinks down").disabled).toBe(true);
        expect(button("Move Mains up").disabled).toBe(false);

        fireEvent.click(button("Move Mains up"));
        expect(button("Move Drinks up").disabled).toBe(true); // saving
        fireEvent.click(button("Move Drinks up"));
        expect(reorderCategories).toHaveBeenCalledTimes(1);
        finish({ data: { success: true } });
        await waitFor(() => expect(button("Move Drinks up").disabled).toBe(false));
    });

    it("keeps a single category in place and shows no list for an empty menu", async () => {
        await renderPage([cat("a", "Only", 0)]);
        expect(button("Move Only up").disabled).toBe(true);
        expect(button("Move Only down").disabled).toBe(true);
        cleanup();

        await renderPage([]);
        expect(await screen.findByText("No categories yet.")).toBeTruthy();
        expect(screen.queryByRole("button", { name: /^Move / })).toBeNull();
    });

    it("lets hidden categories be reordered and keeps them marked Hidden (AC3)", async () => {
        await renderPage([cat("a", "Starters", 0), cat("b", "Secret", 1, false), cat("c", "Drinks", 2)]);
        fireEvent.click(button("Move Secret up"));
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
        fireEvent.click(button("Create"));

        await waitFor(() => expect(order()).toEqual(["Starters", "Mains", "Drinks", "Desserts"]));
    });
});
