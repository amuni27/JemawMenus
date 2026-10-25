// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ToastProvider } from "../../components/ui/ToastContext";

// AGF-S2-33: an unknown restaurant shows the restaurant not-found screen instead of an empty guest page;
// a server or network failure says "temporarily unavailable" with Retry (never "Network Error" or a 404).

const hook = vi.hoisted(() => ({ value: {} as Record<string, unknown>, retry: vi.fn() }));
vi.mock("../../hooks/usePublicBusinessMenu", () => ({ usePublicBusinessMenu: () => ({ ...hook.value, retry: hook.retry }) }));

const { default: CustomerMenu } = await import("./CustomerMenu.tsx");

beforeAll(() => {
    vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} unobserve() {} });
    Element.prototype.scrollIntoView = () => {};
    window.scrollTo = () => {};
});
afterEach(() => { cleanup(); hook.retry.mockReset(); });

const renderMenu = () => render(
    <ToastProvider>
        <MemoryRouter initialEntries={["/unknown-place/menu"]}>
            <Routes><Route path="/:tenantSlug/menu" element={<CustomerMenu />} /></Routes>
        </MemoryRouter>
    </ToastProvider>
);

describe("guest menu errors", () => {
    it("shows the restaurant not-found screen for an unknown business", () => {
        hook.value = { business: undefined, menus: [], loading: false, error: "Business not found", notFound: true };
        renderMenu();
        expect(screen.getByRole("heading", { level: 1, name: "We can't find this restaurant's menu" })).toBeTruthy();
        expect(screen.queryByRole("button", { name: "Select menu category" })).toBeNull();
        expect(screen.queryByText("Business not found")).toBeNull();
    });

    it("shows a friendly unavailable message with Retry for server or network failures", () => {
        hook.value = { business: undefined, menus: [], loading: false, error: "Could not reach the server. Check your connection and try again.", notFound: false };
        renderMenu();
        expect(screen.getByRole("heading", { level: 1, name: "This menu is temporarily unavailable" })).toBeTruthy();
        expect(screen.queryByText("Network Error")).toBeNull();
        expect(screen.queryByRole("heading", { name: /can't find/ })).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "Retry" }));
        expect(hook.retry).toHaveBeenCalledTimes(1);
    });
});
