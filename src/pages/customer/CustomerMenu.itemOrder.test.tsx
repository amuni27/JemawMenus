// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ToastProvider } from "../../components/ui/ToastContext";

// AGF-S2-08: guests see items in the owner's saved order (the API sends them in that order).

const menuData = vi.hoisted(() => ({ value: { business: {} as Record<string, unknown>, menus: [] as unknown[] } }));
vi.mock("../../hooks/usePublicBusinessMenu", () => ({
    usePublicBusinessMenu: () => ({ ...menuData.value, loading: false, error: "" }),
}));

const { default: CustomerMenu } = await import("./CustomerMenu.tsx");

beforeAll(() => {
    vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} unobserve() {} });
    Element.prototype.scrollIntoView = () => {};
    window.scrollTo = () => {};
});
afterEach(cleanup);

const item = (id: string, name: string, sortOrder: number, status = "AVAILABLE") => ({ id, name, price: 10, status, sortOrder });

function renderMenu() {
    menuData.value = {
        business: { id: "biz-1", name: "Cafe" },
        menus: [{ id: "m1", name: "Lunch", categories: [{ id: "c1", menuId: "m1", name: "Mains", sortOrder: 0, items: [
            item("z", "Z Kitfo", 0, "OUT_OF_STOCK"), item("x", "X Tibs", 1), item("y", "Y Shiro", 2),
        ] }] }],
    };
    render(
        <ToastProvider>
            <MemoryRouter initialEntries={["/biz-1/menu"]}>
                <Routes><Route path="/:tenantSlug/menu" element={<CustomerMenu />} /></Routes>
            </MemoryRouter>
        </ToastProvider>
    );
}

const names = () => within(screen.getByRole("main")).getAllByRole("heading", { level: 3 }).map((h) => h.textContent?.trim());

describe("guest item order", () => {
    it("keeps the saved order, including sold-out items, and in search results", () => {
        renderMenu();
        expect(names()).toEqual(["Z Kitfo", "X Tibs", "Y Shiro"]);
        expect(screen.getByText("Sold Out")).toBeTruthy();

        fireEvent.change(screen.getByRole("searchbox", { name: "Search menu items" }), { target: { value: "i" } });
        expect(names()).toEqual(["Z Kitfo", "X Tibs", "Y Shiro"]);
    });
});
