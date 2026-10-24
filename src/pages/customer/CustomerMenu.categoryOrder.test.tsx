// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ToastProvider } from "../../components/ui/ToastContext";

// AGF-S2-07: guests see categories in the owner's saved order.

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

const cat = (id: string, name: string, sortOrder: number) =>
    ({ id, menuId: "m1", name, sortOrder, items: [{ id: `${id}-1`, name: `${name} dish`, price: 10, status: "AVAILABLE" }] });

function renderWith(categories: unknown[]) {
    menuData.value = { business: { id: "biz-1", name: "Cafe" }, menus: [{ id: "m1", name: "Lunch", categories }] };
    render(
        <ToastProvider>
            <MemoryRouter initialEntries={["/biz-1/menu"]}>
                <Routes><Route path="/:tenantSlug/menu" element={<CustomerMenu />} /></Routes>
            </MemoryRouter>
        </ToastProvider>
    );
    return within(screen.getByRole("main")).getAllByRole("heading", { level: 2 }).map((h) => h.textContent?.trim());
}

describe("guest category order", () => {
    it("follows the saved positions", () => {
        expect(renderWith([cat("a", "Starters", 1), cat("b", "Mains", 2), cat("c", "Drinks", 0)]))
            .toEqual(["Drinks", "Starters", "Mains"]);
    });

    it("keeps the server's order for equal positions instead of sorting by name", () => {
        // the API already breaks ties by creation time, like the owner list
        expect(renderWith([cat("z", "Zebra Grill", 0), cat("a", "Apple Bar", 0)])).toEqual(["Zebra Grill", "Apple Bar"]);
    });
});
