// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

// AGF-S2-33 (D-NF-3): a signed-in owner on another business's admin URL sees the owner not-found screen
// instead of their own data under someone else's address.

vi.mock("../../app/context/AuthContext", () => ({
    useAuth: () => ({ user: { fullName: "Demo Owner", email: "owner@example.com" }, business: { id: "own-biz", name: "Cafe" }, logout: vi.fn() }),
}));

const { default: AdminLayout } = await import("./AdminLayout.tsx");

afterEach(() => cleanup());

function renderAt(path: string) {
    render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path="/:tenantSlug/admin" element={<AdminLayout />}>
                    <Route path="menus" element={<p>Owner menus page</p>} />
                </Route>
            </Routes>
        </MemoryRouter>
    );
}

describe("AdminLayout business check", () => {
    it("shows the owner's page under their own business", () => {
        renderAt("/own-biz/admin/menus");
        expect(screen.getByText("Owner menus page")).toBeTruthy();
    });

    it("shows the owner not-found screen under another business's URL", () => {
        renderAt("/other-biz/admin/menus");
        expect(screen.queryByText("Owner menus page")).toBeNull();
        expect(screen.getByRole("heading", { level: 2, name: "We can't find that page" })).toBeTruthy();
        expect(screen.getByRole("link", { name: "Go to your dashboard" }).getAttribute("href")).toBe("/own-biz/admin");
    });
});
