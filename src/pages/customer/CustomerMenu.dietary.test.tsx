// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { ToastProvider } from "../../components/ui/ToastContext";

// AGF-S2-14: dietary chips (vegetarian, vegan, fasting, gluten-free) and "Exclude declared" allergen chips on the
// guest menu, over the already guest-visible items. Fasting is independent; missing allergen data keeps an item.

const menuData = vi.hoisted(() => ({ value: { business: { id: "biz-1", name: "Cafe" }, menus: [] as unknown[] } }));
vi.mock("../../hooks/usePublicBusinessMenu", () => ({
    usePublicBusinessMenu: () => ({ ...menuData.value, loading: false, error: "" }),
}));

const { default: CustomerMenu } = await import("./CustomerMenu.tsx");

type Item = { id: string; name: string; price: number; status: string; tags?: unknown; allergens?: unknown; featured?: boolean };
const item = (id: string, name: string, extra: Partial<Item> = {}): Item => ({ id, name, price: 100, status: "AVAILABLE", ...extra });

const lunch = {
    id: "m1", name: "Lunch", categories: [
        { id: "c1", menuId: "m1", name: "Mains", sortOrder: 0, items: [
            item("a1", "Doro Wat", { tags: ["chef's pick"], allergens: ["eggs"], featured: true }),
            item("a2", "Veggie Combo", { tags: ["Vegetarian"], allergens: ["dairy"] }),
            item("a3", "Shiro", { tags: ["fasting"] }), // fasting only: not vegan, not vegetarian
            item("a4", "Misir", { tags: ["vegan", "fasting"], allergens: [] }), // explicitly both
            item("a5", "Nutty Salad", { tags: ["vegan"], allergens: ["nuts"] }),
            item("a6", "Secret Vegan", { tags: ["vegan"], status: "UNAVAILABLE" }),
        ] },
        { id: "c2", menuId: "m1", name: "Drinks", sortOrder: 1, items: [
            item("d1", "Tea", { tags: ["vegan"], status: "OUT_OF_STOCK" }),
            item("d2", "Milkshake", { allergens: ["dairy"] }),
        ] },
    ],
};
const breakfast = {
    id: "m2", name: "Breakfast", categories: [
        { id: "c3", menuId: "m2", name: "Morning", sortOrder: 0, items: [item("b1", "Firfir", { tags: ["vegetarian"] }), item("b2", "Eggs")] },
    ],
};
const plain = {
    id: "m3", name: "Plain", categories: [{ id: "c4", menuId: "m3", name: "Mains", sortOrder: 0, items: [item("p1", "Tibs", { tags: ["chef's pick"] })] }],
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

const Where = () => {
    const l = useLocation();
    return <p data-testid="where">{l.pathname + l.search + l.hash}</p>;
};

function renderMenu(menus: unknown[]) {
    menuData.value = { business: { id: "biz-1", name: "Cafe" }, menus };
    return render(
        <ToastProvider>
            <MemoryRouter initialEntries={["/biz-1/menu"]}>
                <Routes>
                    <Route path="/:tenantSlug/menu" element={<CustomerMenu />} />
                </Routes>
                <Where />
            </MemoryRouter>
        </ToastProvider>
    );
}

const filters = () => screen.getByRole("group", { name: "Dietary filters" });
const chip = (name: string) => within(filters()).getByRole("button", { name }) as HTMLButtonElement;
const chipNames = () => within(filters()).getAllByRole("button").map((b) => b.getAttribute("aria-label") ?? b.textContent);
const toggle = (name: string) => fireEvent.click(chip(name));
const listedInCategories = (container: HTMLElement) =>
    [...container.querySelectorAll("[data-cat-id] h3")].map((h) => h.textContent);
const tabNames = () => screen.getAllByRole("button").filter((b) => b.hasAttribute("data-cat-tab")).map((b) => b.textContent);
const search = (q: string) => fireEvent.change(screen.getByRole("searchbox", { name: "Search menu items" }), { target: { value: q } });
const NOTE = "Allergen filters use allergen information reported by the restaurant. Missing information doesn't mean a dish is allergen-free. If you have an allergy, please confirm with the restaurant staff.";

describe("dietary filters on the guest menu", () => {
    it("offers only chips for data the active menu has", () => {
        renderMenu([lunch]);
        expect(chipNames()).toEqual([
            "Vegetarian", "Vegan", "Fasting", // no Gluten-free: nobody tagged it
            "Exclude declared: dairy", "Exclude declared: eggs", "Exclude declared: nuts",
        ]);
        expect(within(filters()).getByText("Exclude declared:")).toBeTruthy();
        expect(screen.getByText(NOTE)).toBeTruthy();
        expect(chip("Vegan").getAttribute("aria-pressed")).toBe("false");
    });

    it("shows no chip row for a menu without dietary data", () => {
        renderMenu([plain]);
        expect(screen.queryByRole("group", { name: "Dietary filters" })).toBeNull();
        expect(screen.queryByText(NOTE)).toBeNull();
    });

    it("Vegetarian lists vegetarian and vegan dishes but not a fasting-only dish", () => {
        const { container } = renderMenu([lunch]);
        toggle("Vegetarian");
        expect(chip("Vegetarian").getAttribute("aria-pressed")).toBe("true");
        expect(listedInCategories(container)).toEqual(["Veggie Combo", "Misir", "Nutty Salad", "Tea"]);
    });

    it("Vegan doesn't list a fasting-only dish; Fasting lists only fasting dishes", () => {
        const { container } = renderMenu([lunch]);
        toggle("Vegan");
        expect(listedInCategories(container)).toEqual(["Misir", "Nutty Salad", "Tea"]);
        toggle("Vegan");
        toggle("Fasting");
        expect(listedInCategories(container)).toEqual(["Shiro", "Misir"]);
    });

    it("excluding a declared allergen keeps dishes without allergen information", () => {
        const { container } = renderMenu([lunch]);
        toggle("Exclude declared: nuts");
        const listed = listedInCategories(container);
        expect(listed).not.toContain("Nutty Salad");
        expect(listed).toEqual(expect.arrayContaining(["Shiro", "Misir", "Tea"])); // no allergen data: still listed
        expect(screen.getByText(NOTE)).toBeTruthy();
    });

    it("combines chips with AND, and with the search text", () => {
        const { container } = renderMenu([lunch]);
        toggle("Vegan");
        toggle("Exclude declared: nuts");
        expect(listedInCategories(container)).toEqual(["Misir", "Tea"]);
        search("misir");
        expect(listedInCategories(container)).toEqual(["Misir"]);
    });

    it("narrows the category tabs, hides Chef's picks and announces the result", () => {
        renderMenu([lunch]);
        expect(screen.getByRole("region", { name: "Chef's picks" })).toBeTruthy();
        toggle("Fasting");
        expect(tabNames()).toEqual(["All", "Mains"]);
        expect(screen.queryByRole("region", { name: "Chef's picks" })).toBeNull();
        expect(screen.getByText("2 items match")).toBeTruthy();
    });

    it("shows sold-out matches as Sold Out and never shows hidden ones", () => {
        const { container } = renderMenu([lunch]);
        toggle("Vegan");
        const drinks = container.querySelector('[data-cat-id="c2"]') as HTMLElement;
        expect(within(drinks).getByText("Tea")).toBeTruthy();
        expect(within(drinks).getByText("Sold Out")).toBeTruthy();
        expect(screen.queryByText("Secret Vegan")).toBeNull();
    });

    it("explains when nothing matches and Clear filters restores the full menu", () => {
        const { container } = renderMenu([lunch]);
        toggle("Fasting");
        toggle("Exclude declared: dairy");
        toggle("Vegetarian"); // fasting AND vegetarian, minus dairy: only Misir
        expect(listedInCategories(container)).toEqual(["Misir"]);
        toggle("Exclude declared: eggs");
        toggle("Vegan");
        toggle("Exclude declared: nuts");
        search("tea");
        expect(screen.getByText("No items match these filters")).toBeTruthy();
        const empty = screen.getByText("No items match these filters").closest("div") as HTMLElement;
        fireEvent.click(within(empty).getByRole("button", { name: "Clear filters" }));
        expect(chip("Vegan").getAttribute("aria-pressed")).toBe("false");
        search("");
        expect(listedInCategories(container)).toHaveLength(7);
        expect(screen.getByRole("region", { name: "Chef's picks" })).toBeTruthy();
    });

    it("resets filters when the guest switches menus, and never changes the URL", () => {
        renderMenu([lunch, breakfast]);
        toggle("Vegan");
        expect(screen.getByTestId("where").textContent).toBe("/biz-1/menu");
        fireEvent.click(screen.getByRole("button", { name: "Select menu category" }));
        fireEvent.click(screen.getByRole("button", { name: /Breakfast/ }));
        expect(chipNames()).toEqual(["Vegetarian"]);
        expect(chip("Vegetarian").getAttribute("aria-pressed")).toBe("false");
        expect(screen.getByText("Eggs")).toBeTruthy();
    });

    it("shows dietary badges on cards for vocabulary tags only", () => {
        const { container } = renderMenu([lunch]);
        const misir = [...container.querySelectorAll("[data-cat-id] article")].find((a) => a.textContent?.includes("Misir")) as HTMLElement;
        expect(within(misir).getByText("Vegan")).toBeTruthy();
        expect(within(misir).getByText("Fasting")).toBeTruthy();
        expect(within(misir).queryByText("Vegetarian")).toBeNull(); // only what the owner declared
        const shiro = [...container.querySelectorAll("[data-cat-id] article")].find((a) => a.textContent?.includes("Shiro")) as HTMLElement;
        expect(within(shiro).getByText("Fasting")).toBeTruthy();
        expect(within(shiro).queryByText("Vegan")).toBeNull();
        expect(screen.queryByText("chef's pick")).toBeNull();
    });
});
