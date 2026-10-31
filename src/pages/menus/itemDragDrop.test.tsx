// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ToastProvider } from "../../components/ui/ToastContext";

// AGF-S2-08A: with one category chosen and no search text, owners drag item cards (mouse, touch press-and-hold,
// keyboard) inside the grid. The category's full order goes through the S2-08 reorder API, with its optimistic
// update and rollback. Presses on the card's own buttons never start a drag.

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
const updateStatus = vi.fn();
vi.mock("../../api/itemsApi.ts", () => ({ default: { list, reorder, updateStatus, create: vi.fn(), update: vi.fn(), remove: vi.fn() } }));

const { default: MenuDetailPage } = await import("./MenuDetailPage.tsx");

// jsdom has no layout: lay item cards out in a 3-column grid (200 x 280, 20px gaps) so drops can be found
const COL = 220, ROW = 300;
const box = (i: number) => ({ left: (i % 3) * COL, top: Math.floor(i / 3) * ROW });
const centre = (i: number) => ({ clientX: box(i).left + 100, clientY: box(i).top + 140 });
const originalRect = Element.prototype.getBoundingClientRect;
beforeAll(() => {
    Element.prototype.getBoundingClientRect = function () {
        const index = (this as HTMLElement).closest?.("[data-item-index]")?.getAttribute("data-item-index");
        if (index == null) return originalRect.call(this);
        const { left, top } = box(Number(index));
        return { x: left, y: top, left, top, right: left + 200, bottom: top + 280, width: 200, height: 280, toJSON: () => ({}) } as DOMRect;
    };
});
afterAll(() => { Element.prototype.getBoundingClientRect = originalRect; });

const cat = (id: string, name: string, sortOrder: number) =>
    ({ id, menuId: "m1", name, sortOrder, active: true, isActive: true, createdAt: "", updatedAt: "" });
const item = (id: string, name: string, categoryId: string, sortOrder: number, status = "AVAILABLE") =>
    ({ id, menuId: "m1", categoryId, name, price: 100, ingredients: ["x"], status, sortOrder, createdAt: "", updatedAt: "" });

const CATS = [cat("c1", "Mains", 0), cat("c2", "Drinks", 1)];
const ITEMS = [item("x", "X Tibs", "c1", 0), item("y", "Y Shiro", "c1", 1), item("z", "Z Kitfo", "c1", 2), item("t", "Tea", "c2", 0)];

beforeEach(() => {
    [getMenu, getCategories, list, reorder, updateStatus].forEach((m) => m.mockReset());
    getMenu.mockResolvedValue({ data: { id: "m1", name: "Lunch", isActive: true, visibility: "PUBLIC", currency: "ETB" } });
    getCategories.mockResolvedValue({ data: CATS });
    reorder.mockResolvedValue({ data: { success: true } });
});
afterEach(() => {
    cleanup();
    vi.useRealTimers();
});

async function renderPage(items: unknown[] = ITEMS, category = "Mains") {
    list.mockResolvedValue({ data: items });
    render(
        <ToastProvider>
            <MemoryRouter initialEntries={["/biz-1/admin/menus/m1"]}>
                <Routes><Route path="/:tenantSlug/admin/menus/:menuId" element={<MenuDetailPage />} /></Routes>
            </MemoryRouter>
        </ToastProvider>
    );
    await screen.findByRole("list", { name: "Items" });
    await waitFor(() => expect(within(filter()).getAllByRole("option").length).toBeGreaterThan(1));
    if (category) choose(category);
}

const filter = () => screen.getByLabelText("Category") as HTMLSelectElement;
const choose = (name: string) => {
    const option = within(filter()).getByRole("option", { name }) as HTMLOptionElement;
    fireEvent.change(filter(), { target: { value: option.value } });
};
const order = () => within(screen.getByRole("list", { name: "Items" })).getAllByRole("listitem").map((li) => li.getAttribute("data-name"));
const card = (name: string) => screen.getByRole("group", { name: `Reorder ${name}` });
const indexOf = (name: string) => order().indexOf(name);
const itemAnnouncement = () =>
    [...document.querySelectorAll("[role='status'][aria-live='assertive']")].map((e) => e.textContent ?? "").find((t) => /item|Tibs|Shiro|Kitfo|Wat|Tea/.test(t)) ?? "";

async function mouseDrag(fromEl: Element, from: number, to: number) {
    fireEvent.mouseDown(fromEl, { button: 0, ...centre(from) });
    await act(async () => {
        fireEvent.mouseMove(document, { clientX: centre(from).clientX + 12, clientY: centre(from).clientY });
        fireEvent.mouseMove(document, centre(to));
    });
    await act(async () => { fireEvent.mouseUp(document, centre(to)); });
}
const dragCard = (name: string, to: number) => mouseDrag(card(name), indexOf(name), to);

async function press(el: Element, code: string) {
    await act(async () => { fireEvent.keyDown(el, { code, key: code === "Space" ? " " : code }); });
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
}

describe("item drag and drop", () => {
    it("has no Earlier/Later buttons and no grip icon; the card itself is the drag control", async () => {
        await renderPage();
        const grid = screen.getByRole("list", { name: "Items" });
        expect(screen.queryByRole("button", { name: /^Move .* (earlier|later)$/ })).toBeNull();
        // no grip handle inside the item grid (the category list keeps its own handles)
        expect(within(grid).queryByRole("button", { name: /^Drag .* to reorder$/ })).toBeNull();
        expect(grid.querySelector("svg.lucide-grip-vertical")).toBeNull();
        expect(card("X Tibs").getAttribute("tabindex")).toBe("0");
        // image area, names, prices, badges and actions are still on the card
        const x = card("X Tibs");
        expect(within(x).getByText("No image")).toBeTruthy(); // AGF-S2-16: no photo → placeholder, not a broken <img>
        expect(within(x).getByText("ETB 100.00")).toBeTruthy();
        expect(within(x).getByRole("button", { name: "Hide" })).toBeTruthy();
        // keyboard instructions are attached to the card
        const describedBy = x.getAttribute("aria-describedby")!;
        await waitFor(() => expect(document.getElementById(describedBy)?.textContent).toMatch(/focus the item card and press Space/));
        expect(screen.getByText("Drag a card to change the order. Guests see the same order.")).toBeTruthy();
    });

    it("drags Z Kitfo to the front with the mouse and saves the category's full order once", async () => {
        await renderPage();
        await dragCard("Z Kitfo", 0);
        await waitFor(() => expect(reorder).toHaveBeenCalledTimes(1));
        expect(reorder).toHaveBeenCalledWith("c1", ["z", "x", "y"]);
        expect(order()).toEqual(["Z Kitfo", "X Tibs", "Y Shiro"]);
    });

    it("moves cards across rows of the grid (mouse and keyboard)", async () => {
        const four = [...ITEMS.slice(0, 3), item("w", "W Wat", "c1", 3)]; // W starts on the second row
        await renderPage(four);
        await dragCard("W Wat", 1);
        await waitFor(() => expect(reorder).toHaveBeenLastCalledWith("c1", ["x", "w", "y", "z"]));

        // keyboard: X (row 1, column 1) down to the second row
        const x = card("X Tibs");
        x.focus();
        await press(x, "Space");
        await press(x, "ArrowDown");
        expect(itemAnnouncement()).toMatch(/X Tibs was moved to position 4 of 4\./);
        await press(x, "Space");
        await waitFor(() => expect(reorder).toHaveBeenLastCalledWith("c1", ["w", "y", "z", "x"]));
    });

    it("reorders with the keyboard, announces each step, and cancels with Escape", async () => {
        await renderPage();
        const z = card("Z Kitfo");
        z.focus();
        await press(z, "Space");
        expect(itemAnnouncement()).toMatch(/Picked up Z Kitfo\. It is in position 3 of 3\./);
        await press(z, "ArrowLeft");
        expect(itemAnnouncement()).toMatch(/Z Kitfo was moved to position 2 of 3\./);
        await press(z, "Escape");
        expect(itemAnnouncement()).toMatch(/Z Kitfo was returned to position 3 of 3\./);
        expect(reorder).not.toHaveBeenCalled();

        await press(z, "Space");
        await press(z, "ArrowLeft");
        await press(z, "ArrowLeft");
        await press(z, "Space");
        expect(itemAnnouncement()).toMatch(/Z Kitfo was dropped at position 1 of 3\./);
        await waitFor(() => expect(reorder).toHaveBeenCalledWith("c1", ["z", "x", "y"]));
    });

    it("never starts a drag from the card's buttons, which keep working", async () => {
        updateStatus.mockResolvedValue({ data: { ...ITEMS[0], status: "UNAVAILABLE" } });
        await renderPage();
        const hide = within(card("X Tibs")).getByRole("button", { name: "Hide" });

        await mouseDrag(hide, 0, 2); // press on Hide and drag away
        expect(reorder).not.toHaveBeenCalled();
        expect(order()).toEqual(["X Tibs", "Y Shiro", "Z Kitfo"]);

        fireEvent.click(hide); // a normal click still works
        await waitFor(() => expect(updateStatus).toHaveBeenCalledTimes(1));

        const soldOut = within(card("Y Shiro")).getByRole("button", { name: "Mark sold out" });
        soldOut.focus();
        await press(soldOut, "Space"); // Space on an inner button does not pick the card up
        await press(soldOut, "ArrowRight");
        expect(itemAnnouncement()).not.toMatch(/Picked up/);
        expect(reorder).not.toHaveBeenCalled();
    });

    it("does not call the API when a card is dropped where it started", async () => {
        await renderPage();
        await dragCard("Y Shiro", 1);
        const x = card("X Tibs");
        x.focus();
        await press(x, "Space");
        await press(x, "Space");
        expect(reorder).not.toHaveBeenCalled();
        expect(order()).toEqual(["X Tibs", "Y Shiro", "Z Kitfo"]);
    });

    it("restores the order and shows the reason when saving fails", async () => {
        reorder.mockRejectedValue({ response: { status: 400, data: { message: "orderedIds must list every item of this category exactly once" } } });
        await renderPage();
        await dragCard("Z Kitfo", 0);
        expect((await screen.findByRole("alert")).textContent)
            .toBe("Couldn't save the new order: orderedIds must list every item of this category exactly once");
        expect(order()).toEqual(["X Tibs", "Y Shiro", "Z Kitfo"]);
    });

    it("allows no second reorder while one is saving", async () => {
        let finish: (v: unknown) => void = () => {};
        reorder.mockImplementation(() => new Promise((r) => { finish = r; }));
        await renderPage();
        await dragCard("Z Kitfo", 0);
        expect(screen.getByText("Saving order…")).toBeTruthy();
        expect(card("X Tibs").getAttribute("aria-disabled")).toBe("true");

        await dragCard("X Tibs", 2);
        expect(reorder).toHaveBeenCalledTimes(1);
        await act(async () => finish({ data: { success: true } }));
        await waitFor(() => expect(card("X Tibs").getAttribute("aria-disabled")).toBe("false"));
    });

    it("only reorders within the chosen category, and not with All categories or a search", async () => {
        await renderPage(ITEMS, "");
        expect(screen.queryByRole("group", { name: /^Reorder / })).toBeNull();
        expect(screen.getByText("Choose a category to change the order of its items.")).toBeTruthy();

        choose("Mains");
        expect(order()).toEqual(["X Tibs", "Y Shiro", "Z Kitfo"]); // Tea (Drinks) is not in this grid
        await dragCard("Z Kitfo", 0);
        await waitFor(() => expect(reorder).toHaveBeenCalledWith("c1", ["z", "x", "y"]));
        expect(reorder.mock.calls[0][1]).not.toContain("t");

        fireEvent.change(screen.getByPlaceholderText("Search items"), { target: { value: "i" } });
        expect(screen.queryByRole("group", { name: /^Reorder / })).toBeNull();
        expect(screen.getByText("Clear the search to change the order.")).toBeTruthy();
    });

    it("keeps hidden and sold-out items in the saved order", async () => {
        await renderPage([item("x", "X Tibs", "c1", 0), item("y", "Y Shiro", "c1", 1, "UNAVAILABLE"), item("z", "Z Kitfo", "c1", 2, "OUT_OF_STOCK")]);
        await dragCard("Z Kitfo", 0);
        await waitFor(() => expect(reorder).toHaveBeenCalledWith("c1", ["z", "x", "y"]));
        expect(within(card("Z Kitfo")).getByRole("button", { name: "Back in stock" })).toBeTruthy();
        expect(within(card("Y Shiro")).getByRole("button", { name: "Show" })).toBeTruthy();
    });

    it("supports touch press-and-hold, while a quick swipe does not drag", async () => {
        await renderPage();
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
        const z = card("Z Kitfo");
        const touch = (i: number) => ({ touches: [centre(i)], changedTouches: [centre(i)] });

        // quick swipe: moves before the hold delay, so the page can scroll
        fireEvent.touchStart(z, touch(2));
        await act(async () => { fireEvent.touchMove(z, touch(0)); });
        await act(async () => { fireEvent.touchEnd(z, touch(0)); });
        await act(async () => { vi.advanceTimersByTime(400); });
        expect(reorder).not.toHaveBeenCalled();

        // press and hold, then drag
        fireEvent.touchStart(z, touch(2));
        await act(async () => { vi.advanceTimersByTime(300); });
        await act(async () => {
            fireEvent.touchMove(z, touch(1));
            fireEvent.touchMove(z, touch(0));
        });
        await act(async () => { fireEvent.touchEnd(z, touch(0)); });
        vi.useRealTimers();
        await waitFor(() => expect(reorder).toHaveBeenCalledWith("c1", ["z", "x", "y"]));
    });
});
