// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ToastProvider } from "../../components/ui/ToastContext";

// AGF-S1-13: guest menu shows OUT_OF_STOCK items (Sold Out), counts them (PO-8),
// never shows UNAVAILABLE items, and keeps sold-out waiter-list entries non-incrementable.

const menuData = vi.hoisted(() => ({ value: { business: { id: "biz-1", name: "Cafe" }, menus: [] as unknown[] } }));
vi.mock("../../hooks/usePublicBusinessMenu", () => ({
    usePublicBusinessMenu: () => ({ ...menuData.value, loading: false, error: "" }),
}));

const { default: CustomerMenu } = await import("./CustomerMenu.tsx");

const item = (id: string, name: string, status: string) => ({ id, name, price: 100, status });

beforeAll(() => {
    // jsdom lacks these browser APIs used by the scroll-sync code
    vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} unobserve() {} });
    Element.prototype.scrollIntoView = () => {};
    window.scrollTo = () => {};
});

afterEach(() => {
    cleanup();
    sessionStorage.clear();
});

const renderMenu = (categories: unknown[]) => {
    menuData.value = { business: { id: "biz-1", name: "Cafe" }, menus: [{ id: "m1", name: "Lunch", categories }] };
    render(
        <ToastProvider>
            <MemoryRouter initialEntries={["/biz-1/menu"]}>
                <Routes>
                    <Route path="/:tenantSlug/menu" element={<CustomerMenu />} />
                </Routes>
            </MemoryRouter>
        </ToastProvider>
    );
};

describe("CustomerMenu sold-out handling", () => {
    it("shows OUT_OF_STOCK items with Sold Out and counts them; hides UNAVAILABLE (defensive)", () => {
        renderMenu([{
            id: "c1", menuId: "m1", name: "Mains", sortOrder: 0, items: [
                item("a1", "Doro Wat", "AVAILABLE"), item("a2", "Shiro", "AVAILABLE"),
                item("a3", "Misir", "AVAILABLE"), item("s1", "Tibs", "OUT_OF_STOCK"),
                item("u1", "Hidden Dish", "UNAVAILABLE"),
            ],
        }]);

        expect(screen.getByText("4 items")).toBeTruthy();
        expect(screen.getByText("Tibs")).toBeTruthy();
        expect(screen.getByText("Sold Out")).toBeTruthy();
        expect(screen.queryByText("Hidden Dish")).toBeNull();
    });

    it("does not render an empty 'No items yet' section for a sold-out-only category", () => {
        renderMenu([{ id: "c2", menuId: "m1", name: "Sold Out Only", sortOrder: 0, items: [item("s2", "Kitfo", "OUT_OF_STOCK")] }]);

        expect(screen.getByText("1 item")).toBeTruthy();
        expect(screen.getByText("Kitfo")).toBeTruthy();
        expect(screen.queryByText("No items yet")).toBeNull();
    });

    it("marks an existing waiter-list entry as Sold out and blocks incrementing it", () => {
        sessionStorage.setItem("waiter_list:biz-1", JSON.stringify({
            s1: { itemId: "s1", quantity: 1, snapshot: { name: "Tibs", price: 100, currency: "ETB" } },
            a1: { itemId: "a1", quantity: 1, snapshot: { name: "Doro Wat", price: 100, currency: "ETB" } },
        }));
        renderMenu([{
            id: "c1", menuId: "m1", name: "Mains", sortOrder: 0,
            items: [item("a1", "Doro Wat", "AVAILABLE"), item("s1", "Tibs", "OUT_OF_STOCK")],
        }]);

        fireEvent.click(screen.getByRole("button", { name: "View order" }));
        const drawer = screen.getByText("Waiter List").closest("div.absolute") as HTMLElement;

        expect(within(drawer).getByText("Sold out")).toBeTruthy();
        const increaseTibs = within(drawer).getByRole("button", { name: "Increase Tibs" }) as HTMLButtonElement;
        expect(increaseTibs.disabled).toBe(true);
        fireEvent.click(increaseTibs);
        expect(within(drawer).getAllByText("1")).toBeTruthy();
        const increaseDoro = within(drawer).getByRole("button", { name: "Increase Doro Wat" }) as HTMLButtonElement;
        expect(increaseDoro.disabled).toBe(false);
        expect(JSON.parse(sessionStorage.getItem("waiter_list:biz-1") ?? "{}").s1.quantity).toBe(1);
    });
});
