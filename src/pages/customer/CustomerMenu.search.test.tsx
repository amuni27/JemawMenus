// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ToastProvider } from "../../components/ui/ToastContext";

// AGF-S2-05: guests filter the active menu by name, description or ingredient.

const menuData = vi.hoisted(() => ({ value: { business: {} as Record<string, unknown>, menus: [] as unknown[] } }));
vi.mock("../../hooks/usePublicBusinessMenu", () => ({
    usePublicBusinessMenu: () => ({ ...menuData.value, loading: false, error: "" }),
}));

const { default: CustomerMenu } = await import("./CustomerMenu.tsx");

const item = (id: string, name: string, extra: Record<string, unknown> = {}) =>
    ({ id, name, price: 100, status: "AVAILABLE", ...extra });

const lunch = {
    id: "m1", name: "Lunch", currency: "ETB", categories: [
        {
            id: "c1", menuId: "m1", name: "Mains", sortOrder: 0, items: [
                item("i1", "Special Tibs", { description: "Sautéed beef" }),
                item("i2", "Doro Wat", { description: "Chicken stew", ingredients: ["Chicken", "Berbere", "Egg"] }),
                item("i3", "Lamb Tibs", { status: "OUT_OF_STOCK" }),
                item("i4", "Secret Tibs", { status: "UNAVAILABLE" }),
            ],
        },
        {
            id: "c2", menuId: "m1", name: "Fasting", sortOrder: 1, items: [
                item("i5", "Shiro", { description: "Chickpea stew" }),
                item("i6", "Tibs-style Mushrooms", { ingredients: ["Mushroom", "Jalapeño"] }),
            ],
        },
        { id: "c3", menuId: "m1", name: "Drinks", sortOrder: 2, items: [item("i7", "Café Macchiato")] },
    ],
};
const breakfast = {
    id: "m2", name: "Breakfast", currency: "ETB", categories: [
        { id: "c9", menuId: "m2", name: "Morning", sortOrder: 0, items: [item("i9", "Breakfast Tibs")] },
    ],
};

beforeAll(() => {
    vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} unobserve() {} });
    Element.prototype.scrollIntoView = () => {};
    window.scrollTo = () => {};
});
afterEach(() => {
    cleanup();
    sessionStorage.clear();
});

function renderMenu() {
    menuData.value = { business: { id: "biz-1", name: "Abol Cafe" }, menus: [lunch, breakfast] };
    render(
        <ToastProvider>
            <MemoryRouter initialEntries={["/biz-1/menu"]}>
                <Routes><Route path="/:tenantSlug/menu" element={<CustomerMenu />} /></Routes>
            </MemoryRouter>
        </ToastProvider>
    );
}

const searchBox = () => screen.getByRole("searchbox", { name: "Search menu items" });
const search = (q: string) => fireEvent.change(searchBox(), { target: { value: q } });
const main = () => screen.getByRole("main");
const headings = () => within(main()).queryAllByRole("heading", { level: 2 }).map((h) => h.textContent?.trim());
const names = () => within(main()).queryAllByText(/./, { selector: "h3" }).map((n) => n.textContent?.trim());

describe("guest menu search", () => {
    it("shows only matching items, grouped by category, and hides empty categories", () => {
        renderMenu();
        expect(headings()).toEqual(["Mains", "Fasting", "Drinks"]);
        expect(screen.getByRole("button", { name: "Drinks" })).toBeTruthy();

        search("tibs");
        expect(headings()).toEqual(["Mains", "Fasting"]);
        expect(names()).toEqual(["Special Tibs", "Lamb Tibs", "Tibs-style Mushrooms"]);
        expect(within(main()).queryByText("Doro Wat")).toBeNull();
        // the category tabs follow the results
        expect(screen.queryByRole("button", { name: "Drinks" })).toBeNull();
    });

    it("keeps Sold Out on matching items and never shows hidden items", () => {
        renderMenu();
        search("tibs");
        const lamb = within(main()).getByText("Lamb Tibs").closest("article, li, div[class*='rounded']") as HTMLElement;
        expect(within(main()).getByText("Sold Out")).toBeTruthy();
        expect(lamb).toBeTruthy();
        expect(screen.queryByText("Secret Tibs")).toBeNull();
    });

    it("matches descriptions and ingredients, ignoring case and accents", () => {
        renderMenu();
        search("CHICKEN");
        expect(names()).toEqual(["Doro Wat"]); // ingredient + description
        search("jalapeno");
        expect(names()).toEqual(["Tibs-style Mushrooms"]);
        search("cafe");
        expect(names()).toEqual(["Café Macchiato"]);
        search("stew");
        expect(names()).toEqual(["Doro Wat", "Shiro"]);
    });

    it("searches only the active menu", () => {
        renderMenu();
        search("breakfast");
        expect(screen.getByText('No items match "breakfast"')).toBeTruthy();
    });

    it("shows an empty state with a Clear button that restores the menu", () => {
        renderMenu();
        search("xyz");
        expect(headings()).toEqual([]);
        expect(screen.getByText('No items match "xyz"')).toBeTruthy();

        fireEvent.click(within(main()).getByRole("button", { name: "Clear search" }));
        expect((searchBox() as HTMLInputElement).value).toBe("");
        expect(headings()).toEqual(["Mains", "Fasting", "Drinks"]);
    });

    it("clears from the search box button and with Escape", () => {
        renderMenu();
        search("tibs");
        fireEvent.click(screen.getByRole("button", { name: "Clear search text" }));
        expect((searchBox() as HTMLInputElement).value).toBe("");
        expect(headings()).toHaveLength(3);

        search("tibs");
        fireEvent.keyDown(searchBox(), { key: "Escape" });
        expect((searchBox() as HTMLInputElement).value).toBe("");
    });

    it("keeps adding matches to the waiter list", () => {
        renderMenu();
        search("doro");
        fireEvent.click(screen.getByRole("button", { name: "Add Doro Wat" }));
        expect(screen.getByLabelText("View order").textContent).toContain("1");
        // sold-out matches still cannot be added
        search("lamb");
        expect((screen.getByRole("button", { name: "Lamb Tibs is sold out" }) as HTMLButtonElement)).toBeTruthy();
    });

    it("can be opened from the search icon on small screens", () => {
        renderMenu();
        fireEvent.click(screen.getByRole("button", { name: "Search menu" }));
        expect(document.activeElement).toBe(searchBox());
        // the menu picker sheet does not open for search
        expect(screen.queryByText("Choose a menu")).toBeNull();
    });
});
