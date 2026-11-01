// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ToastProvider } from "../../components/ui/ToastContext";

// AGF-S2-24 (AC10): the guest menu has a "Privacy" link in its footer that opens the menu-views notice.

const menuData = vi.hoisted(() => ({ value: { business: { id: "biz-1", name: "Cafe" }, menus: [] as unknown[] } }));
vi.mock("../../hooks/usePublicBusinessMenu", () => ({
    usePublicBusinessMenu: () => ({ ...menuData.value, loading: false, error: "" }),
}));

const { default: CustomerMenu } = await import("./CustomerMenu.tsx");

beforeAll(() => {
    vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} unobserve() {} });
    Element.prototype.scrollIntoView = () => {};
    window.scrollTo = () => {};
});
afterEach(() => cleanup());

function renderMenu(menus: unknown[]) {
    menuData.value = { business: { id: "biz-1", name: "Cafe" }, menus };
    render(
        <ToastProvider>
            <MemoryRouter initialEntries={["/biz-1/menu"]}>
                <Routes><Route path="/:tenantSlug/menu" element={<CustomerMenu />} /></Routes>
            </MemoryRouter>
        </ToastProvider>
    );
}

const lunch = { id: "m1", name: "Lunch", categories: [
    { id: "c1", menuId: "m1", name: "Mains", sortOrder: 0, items: [{ id: "a1", name: "Shiro", price: 100, status: "AVAILABLE" }] },
] };

describe("guest menu privacy link", () => {
    it("is in the footer and opens the menu-views notice", () => {
        renderMenu([lunch]);
        const footer = screen.getByRole("contentinfo");
        fireEvent.click(within(footer).getByRole("button", { name: "Privacy" }));
        expect(screen.getByRole("dialog", { name: "Menu views" }).textContent).toMatch(/counts menu openings per restaurant and per day/);
    });

    it("is also there when the restaurant has no live menu", () => {
        renderMenu([]);
        expect(within(screen.getByRole("contentinfo")).getByRole("button", { name: "Privacy" })).toBeTruthy();
    });
});
