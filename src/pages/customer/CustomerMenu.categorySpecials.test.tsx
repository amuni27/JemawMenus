// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ToastProvider } from "../../components/ui/ToastContext";

// AGF-S2-36 (checkpoint B): a category special shows its discount on each discounted dish (same display as dish
// specials), a badge under the category heading, and one line in the Specials section that jumps to the category
// (D-CS-7). Dish specials keep their cards (D-CS-4). Everything ends on time without a reload.

const menuData = vi.hoisted(() => ({ value: { business: {} as Record<string, unknown>, menus: [] as unknown[] } }));
vi.mock("../../hooks/usePublicBusinessMenu", () => ({
    usePublicBusinessMenu: () => ({ ...menuData.value, loading: false, error: "" }),
}));

const { default: CustomerMenu } = await import("./CustomerMenu.tsx");

const ENDS = "2026-11-06T15:00:00Z";
const item = (id: string, name: string, price: number, extra: Record<string, unknown> = {}) => ({ id, name, price, status: "AVAILABLE", ...extra });
const byCategory = (price: number, discounted: number) => ({
    specialPrice: discounted, specialType: "CATEGORY", specialPercent: 20, specialNote: "Sweet hour", specialNoteAm: "ጣፋጭ ሰዓት",
    specialUntil: "18:00", specialEndsAt: ENDS, price,
});
const dessertsSpecial = { percent: 20, note: "Sweet hour", noteAm: "ጣፋጭ ሰዓት", until: "18:00", endsAt: ENDS };
const lunch = ({ withDishSpecial = true } = {}) => ({
    id: "m1", name: "Lunch", currency: "ETB", categories: [
        { id: "c1", menuId: "m1", name: "Mains", sortOrder: 0, items: [
            item("i1", "Doro Wat", 420, withDishSpecial ? { specialPrice: 350, specialType: "DISH", specialNote: "Happy hour", specialUntil: "18:00", specialEndsAt: ENDS } : {}),
        ] },
        { id: "c2", menuId: "m1", name: "Desserts", nameAm: "ጣፋጮች", sortOrder: 1, special: dessertsSpecial, items: [
            item("i2", "Baklava", 100, byCategory(100, 80)),
            item("i3", "Kunafa", 150, byCategory(150, 120)),
        ] },
    ],
});

let scrolls: Array<{ top?: number }> = [];
beforeAll(() => {
    vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} unobserve() {} });
    Element.prototype.scrollIntoView = () => {};
});
beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-11-06T13:30:00Z")); // 16:30 in Addis Ababa
    scrolls = [];
    window.scrollTo = ((options: { top?: number }) => { scrolls.push(options); }) as typeof window.scrollTo;
});
afterEach(() => {
    cleanup();
    vi.useRealTimers();
    sessionStorage.clear();
    localStorage.clear();
});

function renderMenu(menus: unknown[]) {
    menuData.value = { business: { id: "biz-1", name: "Abol Cafe", timeZone: "Africa/Addis_Ababa" }, menus };
    render(
        <ToastProvider>
            <MemoryRouter initialEntries={["/biz-1/menu"]}>
                <Routes><Route path="/:tenantSlug/menu" element={<CustomerMenu />} /></Routes>
            </MemoryRouter>
        </ToastProvider>
    );
}

const main = () => screen.getByRole("main");
const specialsSection = () => screen.queryByRole("region", { name: "Specials" });
const desserts = () => within(main()).getByRole("heading", { level: 2, name: "Desserts" }).closest("section") as HTMLElement;
const cardOf = (root: HTMLElement, name: string) => within(root).getAllByRole("heading", { level: 3, name })[0].closest("article, li, div.group") as HTMLElement;

describe("category specials on the guest menu", () => {
    it("shows the discount on each dish and a badge with the note under the category heading", () => {
        renderMenu([lunch()]);
        const section = desserts();
        expect(within(section).getByText("20% off until 18:00")).toBeTruthy();
        expect(within(section).getAllByText("Sweet hour").length).toBeGreaterThan(0);
        const baklava = cardOf(section, "Baklava");
        expect(within(baklava).getByText("80.00")).toBeTruthy();
        expect(within(baklava).getByText("100.00").closest("s")).toBeTruthy();
        expect(within(baklava).getByText("Special")).toBeTruthy();
        expect(within(cardOf(section, "Kunafa")).getByText("120.00")).toBeTruthy();
        // the other category has no badge
        const mains = within(main()).getByRole("heading", { level: 2, name: "Mains" }).closest("section") as HTMLElement;
        expect(within(mains).queryByText(/% off/)).toBeNull();
    });

    it("lists dish specials as cards and the category as one line that jumps to it", async () => {
        renderMenu([lunch()]);
        const section = specialsSection()!;
        expect(within(section).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["Doro Wat"]);
        expect(within(section).getByText("2 specials right now")).toBeTruthy();
        const line = within(section).getByRole("button", { name: "Desserts · 20% off until 18:00" });
        await act(async () => { fireEvent.click(line); await vi.advanceTimersByTimeAsync(50); });
        expect(scrolls.length).toBeGreaterThan(0); // scrolled to the Desserts section (same as its category tab)
    });

    it("shows the Specials section for a category special alone", () => {
        renderMenu([lunch({ withDishSpecial: false })]);
        const section = specialsSection()!;
        expect(within(section).queryAllByRole("heading", { level: 3 })).toHaveLength(0);
        expect(within(section).getByText("1 special right now")).toBeTruthy();
        expect(within(section).getByRole("button", { name: "Desserts · 20% off until 18:00" })).toBeTruthy();
    });

    it("ends on time without a reload: prices, badge and line disappear", () => {
        renderMenu([lunch({ withDishSpecial: false })]);
        expect(specialsSection()).toBeTruthy();
        act(() => { vi.setSystemTime(new Date("2026-11-06T15:00:30Z")); vi.advanceTimersByTime(30_000); });
        expect(specialsSection()).toBeNull();
        const section = desserts();
        expect(within(section).queryByText(/% off/)).toBeNull();
        expect(within(section).queryByText("Sweet hour")).toBeNull();
        expect(within(cardOf(section, "Baklava")).getByText("100.00").closest("s")).toBeNull();
    });

    it("keeps the discounted price in the waiter list", () => {
        renderMenu([lunch()]);
        fireEvent.click(within(desserts()).getByRole("button", { name: "Add Baklava" }));
        fireEvent.click(screen.getByRole("button", { name: "View order" }));
        expect(within(screen.getByRole("dialog")).getByText(/80\.00/)).toBeTruthy();
    });

    it("uses the Amharic category name and note when Amharic is selected", () => {
        renderMenu([lunch()]);
        fireEvent.click(within(screen.getByRole("group", { name: "Menu language" })).getByRole("button", { name: "አማርኛ" }));
        const line = within(specialsSection()!).getByRole("button", { name: "ጣፋጮች · 20% off until 18:00" });
        expect(line.querySelector("[lang='am']")).toBeTruthy();
        const heading = within(main()).getByRole("heading", { level: 2, name: "ጣፋጮች" }).closest("section") as HTMLElement;
        expect(within(heading).getAllByText("ጣፋጭ ሰዓት")[0].closest("[lang]")?.getAttribute("lang")).toBe("am");
    });
});
