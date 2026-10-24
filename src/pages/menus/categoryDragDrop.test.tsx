// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ToastProvider } from "../../components/ui/ToastContext";

// AGF-S2-07A: owners drag categories by a handle (mouse, touch or keyboard). The new order goes through the
// existing reorder API with the same optimistic update and rollback as the up/down buttons.

const getMenu = vi.fn();
vi.mock("../../api/menuApi", () => ({ default: { getMenu, listMenuTypes: vi.fn(), updateMenu: vi.fn() } }));
vi.mock("../../app/context/AuthContext", () => ({ useAuth: () => ({ business: { id: "biz-1" } }) }));
vi.mock("../../hooks/useMenus", () => ({ useMenus: () => ({ deleteMenu: vi.fn() }) }));
vi.mock("../../hooks/useItems.ts", () => ({ useItems: () => ({ items: [] }) }));
vi.mock("../../components/menu/ItemsPanel.tsx", () => ({ default: () => null }));
vi.mock("../../components/menu/ItemModal.tsx", () => ({ default: () => null }));

const getCategories = vi.fn();
const reorderCategories = vi.fn();
vi.mock("../../api/categoriesApi.ts", () => ({
    default: { getCategories, reorderCategories, createCategory: vi.fn(), updateCategory: vi.fn(), deleteCategory: vi.fn() },
}));

const { default: MenuDetailPage } = await import("./MenuDetailPage.tsx");

// jsdom has no layout: give each category row a 40px-high box, stacked 50px apart, so drop targets can be found
const ROW = 50;
const originalRect = Element.prototype.getBoundingClientRect;
beforeAll(() => {
    Element.prototype.getBoundingClientRect = function () {
        const index = (this as HTMLElement).closest?.("[data-index]")?.getAttribute("data-index");
        if (index == null) return originalRect.call(this);
        const top = Number(index) * ROW;
        return { x: 0, y: top, top, left: 0, right: 300, bottom: top + 40, width: 300, height: 40, toJSON: () => ({}) } as DOMRect;
    };
});
afterAll(() => {
    Element.prototype.getBoundingClientRect = originalRect;
});

const cat = (id: string, name: string, sortOrder: number, active = true) =>
    ({ id, menuId: "m1", name, sortOrder, active, isActive: active, createdAt: "", updatedAt: "" });
const ABC = [cat("a", "Starters", 0), cat("b", "Mains", 1), cat("c", "Drinks", 2)];

beforeEach(() => {
    [getMenu, getCategories, reorderCategories].forEach((m) => m.mockReset());
    getMenu.mockResolvedValue({ data: { id: "m1", name: "Lunch", isActive: true, visibility: "PUBLIC", currency: "ETB" } });
    reorderCategories.mockResolvedValue({ data: { success: true } });
});
afterEach(() => {
    cleanup();
    vi.useRealTimers();
});

async function renderPage(categories: unknown[] = ABC) {
    getCategories.mockResolvedValue({ data: categories });
    render(
        <ToastProvider>
            <MemoryRouter initialEntries={["/biz-1/admin/menus/m1"]}>
                <Routes><Route path="/:tenantSlug/admin/menus/:menuId" element={<MenuDetailPage />} /></Routes>
            </MemoryRouter>
        </ToastProvider>
    );
    await screen.findByRole("list", { name: "Categories" });
}

const order = () => within(screen.getByRole("list", { name: "Categories" })).getAllByRole("listitem").map((li) => li.getAttribute("data-name"));
const handle = (name: string) => screen.getByRole("button", { name: `Drag ${name} to reorder` });
const announcements = () => document.querySelector("[role='status'][aria-live='assertive']")?.textContent ?? "";

/** Mouse drag on a handle: press, move past the 5px threshold, then to the target row's centre, release. */
async function mouseDrag(name: string, toIndex: number) {
    const el = handle(name);
    const from = Number(el.closest("[data-index]")!.getAttribute("data-index"));
    const startY = from * ROW + 20;
    const endY = toIndex * ROW + 20;
    fireEvent.mouseDown(el, { button: 0, clientX: 10, clientY: startY });
    await act(async () => {
        fireEvent.mouseMove(document, { clientX: 10, clientY: startY + 10 });
        fireEvent.mouseMove(document, { clientX: 10, clientY: endY });
    });
    await act(async () => {
        fireEvent.mouseUp(document, { clientX: 10, clientY: endY });
    });
}

async function key(el: Element, code: string) {
    await act(async () => {
        fireEvent.keyDown(el, { code, key: code === "Space" ? " " : code });
    });
    // dnd-kit measures drop targets after pick-up; let that frame run
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
}

describe("category drag and drop", () => {
    it("shows a visible drag handle on every row, next to the up/down buttons", async () => {
        await renderPage();
        for (const name of ["Starters", "Mains", "Drinks"]) {
            expect(handle(name)).toBeTruthy();
            expect(screen.getByRole("button", { name: `Move ${name} up` })).toBeTruthy();
            expect(screen.getByRole("button", { name: `Move ${name} down` })).toBeTruthy();
        }
    });

    it("drags Drinks to the top with the mouse and saves the full order once", async () => {
        await renderPage();
        await mouseDrag("Drinks", 0);

        await waitFor(() => expect(reorderCategories).toHaveBeenCalledTimes(1));
        expect(reorderCategories).toHaveBeenCalledWith("m1", ["c", "a", "b"]);
        expect(order()).toEqual(["Drinks", "Starters", "Mains"]);
    });

    it("reorders with the keyboard and announces each step", async () => {
        await renderPage();
        const h = handle("Starters");
        h.focus();

        await key(h, "Space");
        expect(announcements()).toMatch(/Picked up Starters\. It is in position 1 of 3\./);
        await key(h, "ArrowDown");
        expect(announcements()).toMatch(/Starters was moved to position 2 of 3\./);
        await key(h, "Space");
        expect(announcements()).toMatch(/Starters was dropped at position 2 of 3\./);

        await waitFor(() => expect(reorderCategories).toHaveBeenCalledWith("m1", ["b", "a", "c"]));
        expect(order()).toEqual(["Mains", "Starters", "Drinks"]);
    });

    it("cancels a keyboard drag with Escape and saves nothing", async () => {
        await renderPage();
        const h = handle("Starters");
        h.focus();
        await key(h, "Space");
        await key(h, "ArrowDown");
        await key(h, "Escape");

        expect(announcements()).toMatch(/Starters was returned to position 1/);
        expect(order()).toEqual(["Starters", "Mains", "Drinks"]);
        expect(reorderCategories).not.toHaveBeenCalled();
    });

    it("does not call the API when a category is dropped where it started", async () => {
        await renderPage();
        await mouseDrag("Mains", 1);
        const h = handle("Starters");
        h.focus();
        await key(h, "Space");
        await key(h, "Space");

        expect(order()).toEqual(["Starters", "Mains", "Drinks"]);
        expect(reorderCategories).not.toHaveBeenCalled();
    });

    it("restores the order and shows the reason when saving a drop fails", async () => {
        reorderCategories.mockRejectedValue({ response: { status: 400, data: { message: "orderedIds must list every category of this menu exactly once" } } });
        await renderPage();
        await mouseDrag("Drinks", 0);

        expect((await screen.findByRole("alert")).textContent)
            .toBe("Couldn't save the new order: orderedIds must list every category of this menu exactly once");
        expect(order()).toEqual(["Starters", "Mains", "Drinks"]);
    });

    it("allows no second reorder, by drag or button, while one is saving", async () => {
        let finish: (v: unknown) => void = () => {};
        reorderCategories.mockImplementation(() => new Promise((r) => { finish = r; }));
        await renderPage();
        await mouseDrag("Drinks", 0);
        expect(reorderCategories).toHaveBeenCalledTimes(1);

        expect(handle("Starters").getAttribute("aria-disabled")).toBe("true");
        await mouseDrag("Starters", 2);
        fireEvent.click(screen.getByRole("button", { name: "Move Mains down" }));
        expect(reorderCategories).toHaveBeenCalledTimes(1);

        await act(async () => finish({ data: { success: true } }));
        await waitFor(() => expect(handle("Starters").getAttribute("aria-disabled")).toBe("false"));
    });

    it("lets a hidden category be dragged and keeps it marked Hidden", async () => {
        await renderPage([cat("a", "Starters", 0), cat("b", "Secret", 1, false), cat("c", "Drinks", 2)]);
        await mouseDrag("Secret", 0);
        await waitFor(() => expect(reorderCategories).toHaveBeenCalledWith("m1", ["b", "a", "c"]));
        const first = within(screen.getByRole("list", { name: "Categories" })).getAllByRole("listitem")[0];
        expect(within(first).getByText("Hidden")).toBeTruthy();
    });

    it("supports touch: a press-and-hold on the handle starts the drag", async () => {
        await renderPage();
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
        const el = handle("Drinks");
        const touch = (y: number) => ({ touches: [{ clientX: 10, clientY: y }], changedTouches: [{ clientX: 10, clientY: y }] });

        // dnd-kit's touch sensor follows the touch on the element it started on
        fireEvent.touchStart(el, touch(2 * ROW + 20));
        await act(async () => { vi.advanceTimersByTime(250); });
        await act(async () => {
            fireEvent.touchMove(el, touch(ROW + 20));
            fireEvent.touchMove(el, touch(20));
        });
        await act(async () => { fireEvent.touchEnd(el, touch(20)); });
        vi.useRealTimers();

        await waitFor(() => expect(reorderCategories).toHaveBeenCalledWith("m1", ["c", "a", "b"]));
    });

    it("does not start a touch drag on a quick swipe (the page can scroll)", async () => {
        await renderPage();
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
        const el = handle("Drinks");
        const touch = (y: number) => ({ touches: [{ clientX: 10, clientY: y }], changedTouches: [{ clientX: 10, clientY: y }] });

        fireEvent.touchStart(el, touch(2 * ROW + 20));
        await act(async () => { fireEvent.touchMove(el, touch(20)); }); // moved before the hold delay
        await act(async () => { fireEvent.touchEnd(el, touch(20)); });
        await act(async () => { vi.advanceTimersByTime(300); });
        vi.useRealTimers();

        expect(reorderCategories).not.toHaveBeenCalled();
        expect(order()).toEqual(["Starters", "Mains", "Drinks"]);
    });
});
