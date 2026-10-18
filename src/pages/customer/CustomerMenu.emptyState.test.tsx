// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ToastProvider } from "../../components/ui/ToastContext";

// AGF-S1-15 / PO-2: a business without visible menus shows "Menu coming soon" on its QR URL.

const state = vi.hoisted(() => ({ value: { business: { id: "biz-1", name: "Cafe" }, menus: [] as unknown[], loading: false, error: "" } }));
vi.mock("../../hooks/usePublicBusinessMenu", () => ({ usePublicBusinessMenu: () => state.value }));

const { default: CustomerMenu } = await import("./CustomerMenu.tsx");

beforeAll(() => {
    vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} unobserve() {} });
    Element.prototype.scrollIntoView = () => {};
    window.scrollTo = () => {};
});
afterEach(() => cleanup());

function renderGuest() {
    render(
        <ToastProvider>
            <MemoryRouter initialEntries={["/biz-1/menu"]}>
                <Routes>
                    <Route path="/:tenantSlug/menu" element={<CustomerMenu />} />
                </Routes>
            </MemoryRouter>
        </ToastProvider>
    );
}

describe("guest menu empty state", () => {
    it("shows 'Menu coming soon' when the business has no visible menus", () => {
        state.value = { business: { id: "biz-1", name: "Cafe" }, menus: [], loading: false, error: "" };
        renderGuest();
        expect(screen.getByText("Menu coming soon")).toBeTruthy();
        expect(screen.queryByText("Select a menu.")).toBeNull();
    });

    it("does not show it while loading or when loading failed", () => {
        state.value = { business: { id: "biz-1", name: "Cafe" }, menus: [], loading: true, error: "" };
        renderGuest();
        expect(screen.queryByText("Menu coming soon")).toBeNull();
        cleanup();

        state.value = { business: { id: "biz-1", name: "Cafe" }, menus: [], loading: false, error: "Item not found" };
        renderGuest();
        expect(screen.queryByText("Menu coming soon")).toBeNull();
        expect(screen.getByText("Item not found")).toBeTruthy();
    });
});
