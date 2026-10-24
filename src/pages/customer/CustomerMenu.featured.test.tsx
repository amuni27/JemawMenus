// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { ToastProvider } from "../../components/ui/ToastContext";

// AGF-S2-15: "Chef's picks" on the guest menu, built from the already guest-visible items of the active menu.
// Featured items stay in their categories; the category bar, search and waiter list keep working as before.

const menuData = vi.hoisted(() => ({ value: { business: { id: "biz-1", name: "Cafe" }, menus: [] as unknown[] } }));
vi.mock("../../hooks/usePublicBusinessMenu", () => ({
    usePublicBusinessMenu: () => ({ ...menuData.value, loading: false, error: "" }),
}));

const { default: CustomerMenu } = await import("./CustomerMenu.tsx");

type Item = { id: string; name: string; price: number; status: string; featured?: boolean; isFeatured?: boolean };
const item = (id: string, name: string, extra: Partial<Item> = {}): Item =>
    ({ id, name, price: 100, status: "AVAILABLE", ...extra });

const lunch = {
    id: "m1", name: "Lunch", categories: [
        // deliberately listed out of order: the page sorts by sortOrder (S2-07)
        { id: "c2", menuId: "m1", name: "Drinks", sortOrder: 1, items: [item("d1", "Mango Juice", { featured: true }), item("d2", "Tea")] },
        { id: "c1", menuId: "m1", name: "Mains", sortOrder: 0, items: [
            item("a1", "Doro Wat"),
            item("a2", "Kitfo", { featured: true }),
            item("a3", "Tibs", { featured: true, status: "OUT_OF_STOCK" }),
            item("u1", "Secret Special", { featured: true, status: "UNAVAILABLE" }),
        ] },
    ],
};
const breakfast = {
    id: "m2", name: "Breakfast", categories: [
        { id: "c3", menuId: "m2", name: "Morning", sortOrder: 0, items: [item("b1", "Chechebsa", { isFeatured: true }), item("b2", "Firfir")] },
    ],
};
const plain = {
    id: "m3", name: "Plain", categories: [
        { id: "c4", menuId: "m3", name: "Mains", sortOrder: 0, items: [item("p1", "Shiro"), item("p2", "Misir", { featured: false })] },
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

const Where = () => <p data-testid="where">{useLocation().pathname}</p>;

function renderMenu(menus: unknown[]) {
    menuData.value = { business: { id: "biz-1", name: "Cafe" }, menus };
    return render(
        <ToastProvider>
            <MemoryRouter initialEntries={["/biz-1/menu"]}>
                <Routes>
                    <Route path="/:tenantSlug/menu" element={<CustomerMenu />}>
                        <Route path="item/:itemId" element={<p>Item detail</p>} />
                    </Route>
                </Routes>
                <Where />
            </MemoryRouter>
        </ToastProvider>
    );
}

const picks = () => screen.getByRole("region", { name: "Chef's picks" });
const queryPicks = () => screen.queryByRole("region", { name: "Chef's picks" });
const pickNames = () => within(picks()).getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
const categoryBlock = (container: HTMLElement, id: string) => container.querySelector(`[data-cat-id="${id}"]`) as HTMLElement;
const tabNames = () => screen.getAllByRole("button").filter((b) => b.hasAttribute("data-cat-tab")).map((b) => b.textContent);
const search = (q: string) => fireEvent.change(screen.getByRole("searchbox", { name: "Search menu items" }), { target: { value: q } });

describe("Chef's picks on the guest menu", () => {
    it("shows the active menu's featured items in category order, then item order", () => {
        renderMenu([lunch]);
        expect(pickNames()).toEqual(["Kitfo", "Tibs", "Mango Juice"]);
        expect(within(picks()).getByRole("heading", { level: 2, name: "Chef's picks" })).toBeTruthy();
        expect(within(picks()).getByRole("list").children).toHaveLength(3);
    });

    it("comes before the first category", () => {
        const { container } = renderMenu([lunch]);
        const first = categoryBlock(container, "c1");
        expect(picks().compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("keeps featured items in their own categories too", () => {
        const { container } = renderMenu([lunch]);
        expect(within(categoryBlock(container, "c1")).getByText("Kitfo")).toBeTruthy();
        expect(within(categoryBlock(container, "c2")).getByText("Mango Juice")).toBeTruthy();
        expect(within(categoryBlock(container, "c1")).getByText("3 items")).toBeTruthy(); // category counts unchanged
    });

    it("adds to one waiter-list entry from either place", () => {
        const { container } = renderMenu([lunch]);
        fireEvent.click(within(picks()).getByRole("button", { name: "Add Kitfo" }));
        fireEvent.click(within(categoryBlock(container, "c1")).getByRole("button", { name: "Add Kitfo" }));
        const stored = JSON.parse(sessionStorage.getItem("waiter_list:biz-1") ?? "{}");
        expect(Object.keys(stored)).toEqual(["a2"]);
        expect(stored.a2.quantity).toBe(2);
    });

    it("shows a sold-out pick as Sold Out with a disabled add button, and it still opens", () => {
        renderMenu([lunch]);
        expect(within(picks()).getByText("Sold Out")).toBeTruthy();
        expect((within(picks()).getByRole("button", { name: "Tibs is sold out" }) as HTMLButtonElement).disabled).toBe(true);
        fireEvent.click(within(picks()).getByText("Tibs"));
        expect(screen.getByTestId("where").textContent).toBe("/biz-1/menu/item/a3");
        expect(queryPicks()).toBeNull(); // the item detail replaces the list, picks included
    });

    it("never shows a featured item that guests may not see", () => {
        renderMenu([lunch]);
        expect(screen.queryByText("Secret Special")).toBeNull();
    });

    it("renders nothing when the menu has no featured items", () => {
        renderMenu([plain]);
        expect(queryPicks()).toBeNull();
        expect(screen.queryByText("Chef's picks")).toBeNull();
    });

    it("follows the active menu when the guest switches menus", () => {
        renderMenu([lunch, breakfast]);
        expect(pickNames()).toEqual(["Kitfo", "Tibs", "Mango Juice"]);
        fireEvent.click(screen.getByRole("button", { name: "Select menu category" }));
        fireEvent.click(screen.getByRole("button", { name: /Breakfast/ }));
        expect(pickNames()).toEqual(["Chechebsa"]); // the older isFeatured shape counts too
    });

    it("is hidden while searching and returns when the search is cleared", () => {
        renderMenu([lunch]);
        search("kitfo");
        expect(queryPicks()).toBeNull();
        expect(screen.getAllByText("Kitfo")).toHaveLength(1);
        search("");
        expect(picks()).toBeTruthy();
    });

    it("leaves the category bar unchanged and adds no tab", () => {
        renderMenu([lunch]);
        expect(tabNames()).toEqual(["All", "Mains", "Drinks"]);
        cleanup();
        const unfeatured = { ...lunch, categories: lunch.categories.map((c) => ({ ...c, items: c.items.map((i) => ({ ...i, featured: false })) })) };
        renderMenu([unfeatured]);
        expect(tabNames()).toEqual(["All", "Mains", "Drinks"]);
    });

    it("lets keyboard users reach the row when it scrolls sideways", () => {
        const sw = vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(900);
        const cw = vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(375);
        try {
            renderMenu([lunch]);
            const list = within(picks()).getByRole("list");
            expect(list.getAttribute("tabindex")).toBe("0");
            expect(list.getAttribute("aria-label")).toBe("Chef's picks, scroll for more");
        } finally {
            sw.mockRestore();
            cw.mockRestore();
        }
    });

    it("doesn't make the row focusable when it doesn't scroll", () => {
        renderMenu([lunch]);
        expect(within(picks()).getByRole("list").hasAttribute("tabindex")).toBe(false);
    });
});
