// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ToastProvider } from "../../components/ui/ToastContext";

// AGF E4-M7 (AC7, C2): one sponsored slot after the Specials section and before the categories; before the categories
// when there are no Specials; none without an ad.

const menuData = vi.hoisted(() => ({ value: { business: {} as Record<string, unknown>, menus: [] as unknown[], sponsored: undefined as unknown } }));
vi.mock("../../hooks/usePublicBusinessMenu", () => ({
    usePublicBusinessMenu: () => ({ ...menuData.value, loading: false, error: "" }),
}));

const { default: CustomerMenu } = await import("./CustomerMenu.tsx");

const item = (id: string, name: string, extra: Record<string, unknown> = {}) => ({ id, name, price: 420, status: "AVAILABLE", ...extra });
const lunch = (special: boolean) => ({ id: "m1", name: "Lunch", currency: "ETB", categories: [
    { id: "c1", menuId: "m1", name: "Mains", sortOrder: 0, items: [
        item("i1", "Doro Wat", special ? { specialPrice: 350, specialUntil: "23:59", specialEndsAt: "2099-01-01T00:00:00Z" } : {}),
    ] },
] });
const ad = { adId: "a1", title: "Coffee week", body: "Try the new roast", linkUrl: "https://example.test/coffee" };

beforeAll(() => {
    vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} unobserve() {} });
    Element.prototype.scrollIntoView = () => {};
    window.scrollTo = () => {};
});
afterEach(() => { cleanup(); sessionStorage.clear(); localStorage.clear(); });

function renderMenu(menus: unknown[], sponsored?: unknown) {
    menuData.value = { business: { id: "biz-1", name: "Abol Cafe", timeZone: "Africa/Addis_Ababa" }, menus, sponsored };
    render(
        <ToastProvider>
            <MemoryRouter initialEntries={["/biz-1/menu"]}>
                <Routes><Route path="/:tenantSlug/menu" element={<CustomerMenu />} /></Routes>
            </MemoryRouter>
        </ToastProvider>
    );
}

const follows = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

describe("the sponsored slot on the guest menu", () => {
    it("sits after Specials and before the categories", () => {
        renderMenu([lunch(true)], ad);
        const specials = screen.getByRole("region", { name: "Specials" });
        const slot = screen.getByRole("region", { name: "Sponsored" });
        const category = screen.getAllByRole("heading", { name: "Mains" }).at(-1)!;
        expect(follows(specials, slot)).toBe(true);
        expect(follows(slot, category)).toBe(true);
    });

    it("sits before the categories when there are no Specials", () => {
        renderMenu([lunch(false)], ad);
        expect(screen.queryByRole("region", { name: "Specials" })).toBeNull();
        const slot = screen.getByRole("region", { name: "Sponsored" });
        expect(follows(slot, screen.getAllByRole("heading", { name: "Mains" }).at(-1)!)).toBe(true);
    });

    it("is absent without an ad", () => {
        renderMenu([lunch(true)]);
        expect(screen.queryByRole("region", { name: "Sponsored" })).toBeNull();
    });
});
