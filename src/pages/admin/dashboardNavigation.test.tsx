// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

// AGF-S2-09 / D4: the dashboard is reachable from the owner navigation; Menus stays the landing page after login.

vi.mock("../../app/context/AuthContext", () => ({
    useAuth: () => ({ user: { fullName: "Demo Owner", email: "owner@example.com" }, business: { id: "biz-1", name: "Cafe" }, logout: vi.fn() }),
}));

const { default: AdminLayout } = await import("../../components/layout/AdminLayout.tsx");

afterEach(cleanup);

function renderAt(path: string) {
    render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path="/:tenantSlug/admin/*" element={<AdminLayout />} />
            </Routes>
        </MemoryRouter>
    );
    return screen.getByRole("navigation");
}

const isCurrent = (nav: HTMLElement, name: string) => within(nav).getByRole("link", { name }).getAttribute("aria-current") === "page";

describe("owner navigation", () => {
    it("has a Dashboard link to /{business}/admin, next to Menus and QR Code", () => {
        const nav = renderAt("/biz-1/admin/menus");
        expect(within(nav).getAllByRole("link").map((l) => l.textContent)).toEqual(["Dashboard", "Menus", "QR Code"]);
        expect(within(nav).getByRole("link", { name: "Dashboard" }).getAttribute("href")).toBe("/biz-1/admin");
    });

    it("marks only the current page", () => {
        let nav = renderAt("/biz-1/admin");
        expect(isCurrent(nav, "Dashboard")).toBe(true);
        expect(isCurrent(nav, "Menus")).toBe(false);
        cleanup();

        nav = renderAt("/biz-1/admin/menus/m1");
        expect(isCurrent(nav, "Dashboard")).toBe(false);
        expect(isCurrent(nav, "Menus")).toBe(true);
        cleanup();

        nav = renderAt("/biz-1/admin/qrcode");
        expect(isCurrent(nav, "Dashboard")).toBe(false);
        expect(isCurrent(nav, "QR Code")).toBe(true);
    });
});
