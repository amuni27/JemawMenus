// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ToastProvider } from "../../components/ui/ToastContext";

// AGF-S2-25 (checkpoint B): an applicable special shows the special price with the regular price struck through, a
// "Special" badge and "until HH:mm" wherever the dish appears, plus a "Specials" section at the top of the active
// menu. It disappears at its end time without a reload. The waiter list keeps the price shown when the dish was added.

const menuData = vi.hoisted(() => ({ value: { business: {} as Record<string, unknown>, menus: [] as unknown[] } }));
vi.mock("../../hooks/usePublicBusinessMenu", () => ({
    usePublicBusinessMenu: () => ({ ...menuData.value, loading: false, error: "" }),
}));

const { default: CustomerMenu } = await import("./CustomerMenu.tsx");

const item = (id: string, name: string, extra: Record<string, unknown> = {}) => ({ id, name, price: 420, status: "AVAILABLE", ...extra });
const doroSpecial = { specialPrice: 350, specialNote: "Happy hour", specialNoteAm: "ደስታ ሰዓት", specialUntil: "18:00", specialEndsAt: "2026-11-06T15:00:00Z" };
const lunch = (doroExtra: Record<string, unknown> = doroSpecial) => ({
    id: "m1", name: "Lunch", currency: "ETB", categories: [
        { id: "c1", menuId: "m1", name: "Mains", nameAm: "ዋና ምግቦች", sortOrder: 0, items: [
            item("i1", "Doro Wat", { nameAm: "ዶሮ ወጥ", ...doroExtra }),
            item("i2", "Beef Tibs", { price: 380 }),
        ] },
    ],
});

beforeAll(() => {
    vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} unobserve() {} });
    Element.prototype.scrollIntoView = () => {};
    window.scrollTo = () => {};
});
beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-11-06T13:30:00Z")); // 16:30 in Addis Ababa
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
const cardOf = (root: HTMLElement, name: string) => within(root).getAllByRole("heading", { level: 3, name })[0].closest("article, li, div.group") as HTMLElement;

describe("specials on the guest menu", () => {
    it("shows a Specials section with the special price, struck regular price, badge and end time", () => {
        renderMenu([lunch()]);
        const section = specialsSection()!;
        expect(section).toBeTruthy();
        expect(within(section).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["Doro Wat"]);
        expect(within(section).getByText("Happy hour")).toBeTruthy();
        const card = cardOf(section, "Doro Wat");
        expect(within(card).getByText("350.00")).toBeTruthy();
        expect(within(card).getByText("420.00").closest("s")).toBeTruthy();
        expect(within(card).getByText("Special")).toBeTruthy();
        expect(within(card).getByText("until 18:00")).toBeTruthy();
    });

    it("shows the special on the dish's regular card too, and nothing for other dishes", () => {
        renderMenu([lunch()]);
        const mains = within(main()).getByRole("heading", { level: 2, name: "Mains" }).closest("section") as HTMLElement;
        expect(within(cardOf(mains, "Doro Wat")).getByText("350.00")).toBeTruthy();
        const tibs = cardOf(mains, "Beef Tibs");
        expect(within(tibs).getByText("380.00")).toBeTruthy();
        expect(within(tibs).queryByText("Special")).toBeNull();
    });

    it("has no Specials section without specials or while searching", () => {
        renderMenu([lunch({})]);
        expect(specialsSection()).toBeNull();
        cleanup();
        renderMenu([lunch()]);
        fireEvent.change(screen.getByRole("searchbox", { name: "Search menu items" }), { target: { value: "doro" } });
        expect(specialsSection()).toBeNull();
    });

    it("disappears at its end time without a reload", () => {
        renderMenu([lunch()]);
        expect(specialsSection()).toBeTruthy();
        act(() => { vi.setSystemTime(new Date("2026-11-06T15:00:30Z")); vi.advanceTimersByTime(30_000); });
        expect(specialsSection()).toBeNull();
        const mains = within(main()).getByRole("heading", { level: 2, name: "Mains" }).closest("section") as HTMLElement;
        expect(within(cardOf(mains, "Doro Wat")).getByText("420.00").closest("s")).toBeNull();
        expect(within(mains).queryByText("Special")).toBeNull();
    });

    it("keeps the special price in the waiter list when the dish was added during the special", () => {
        renderMenu([lunch()]);
        fireEvent.click(within(specialsSection()!).getByRole("button", { name: "Add Doro Wat" }));
        fireEvent.click(screen.getByRole("button", { name: "View order" }));
        expect(within(screen.getByRole("dialog")).getByText(/350\.00/)).toBeTruthy();
    });

    it("can't add a sold-out dish on special", () => {
        renderMenu([lunch({ ...doroSpecial, status: "OUT_OF_STOCK" })]);
        const button = within(specialsSection()!).getByRole("button", { name: "Doro Wat is sold out" }) as HTMLButtonElement;
        fireEvent.click(button);
        fireEvent.click(screen.getByRole("button", { name: "View order" }));
        expect(within(screen.getByRole("dialog")).queryByText("Doro Wat")).toBeNull();
    });

    it("shows the Amharic note when Amharic is selected", () => {
        renderMenu([lunch()]);
        fireEvent.click(within(screen.getByRole("group", { name: "Menu language" })).getByRole("button", { name: "አማርኛ" }));
        const section = specialsSection()!;
        expect(within(section).getByText("ደስታ ሰዓት").closest("[lang]")?.getAttribute("lang")).toBe("am");
    });
});
