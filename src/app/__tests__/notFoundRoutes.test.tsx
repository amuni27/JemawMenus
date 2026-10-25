// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router-dom";

// AGF-S2-33: the real route table shows branded not-found screens instead of blank pages or the router's
// developer screen; owner URLs stay behind the login guard.

const auth = vi.hoisted(() => ({ signedIn: true }));
vi.mock("../../components/auth/RequireAuth.tsx", () => ({
    default: ({ children }: { children: React.ReactNode }) => (auth.signedIn ? <>{children}</> : <p>Login page</p>),
}));
vi.mock("../../app/context/AuthContext", () => ({ useAuth: () => ({ business: { id: "biz-1", name: "Cafe" }, user: null, logout: vi.fn() }) }));
vi.mock("../../components/layout/AdminLayout.tsx", () => ({ default: () => <div><p>Admin layout</p><Outlet /></div> }));
vi.mock("../../pages/admin/Dashboard", () => ({ default: () => <p>Dashboard page</p> }));
vi.mock("../../pages/customer/CustomerMenu.tsx", () => ({ default: () => <p>Guest menu page</p> }));

const { routes } = await import("../routes.tsx");

afterEach(() => {
    cleanup();
    auth.signedIn = true;
});

function renderAt(path: string) {
    const router = createMemoryRouter(routes, { initialEntries: [path] });
    render(<RouterProvider router={router} />);
    return router;
}

describe("not-found routing", () => {
    it.each(["/auth/nope", "/does/not/exist/at/all"])("shows the public not-found screen for %s", async (path) => {
        renderAt(path);
        expect(await screen.findByRole("heading", { level: 1, name: "We can't find that page" })).toBeTruthy();
        expect(screen.getByRole("link", { name: "Go to the home page" })).toBeTruthy();
        expect(document.body.textContent).not.toMatch(/Unexpected Application Error|Hey developer/);
    });

    it("sends a bare business URL to that restaurant's menu", async () => {
        const router = renderAt("/biz-1");
        expect(await screen.findByText("Guest menu page")).toBeTruthy();
        expect(router.state.location.pathname).toBe("/biz-1/menu");
    });

    it("shows the owner not-found screen for an unknown admin URL when signed in", async () => {
        renderAt("/biz-1/admin/nope");
        expect(await screen.findByText("Admin layout")).toBeTruthy();
        expect(screen.getByRole("heading", { level: 2, name: "We can't find that page" })).toBeTruthy();
        expect(screen.getByRole("link", { name: "Go to your dashboard" }).getAttribute("href")).toBe("/biz-1/admin");
    });

    it("sends signed-out visitors on unknown admin URLs to login, not a 404", async () => {
        auth.signedIn = false;
        renderAt("/biz-1/admin/nope");
        expect(await screen.findByText("Login page")).toBeTruthy();
        expect(screen.queryByRole("heading", { name: "We can't find that page" })).toBeNull();
    });

    it("wraps every route in a branded root error element", () => {
        expect(routes).toHaveLength(1);
        expect(routes[0].errorElement).toBeTruthy();
    });

    it("keeps existing routes working", async () => {
        renderAt("/biz-1/admin");
        expect(await screen.findByText("Dashboard page")).toBeTruthy();
        cleanup();
        renderAt("/biz-1/menu");
        expect(await screen.findByText("Guest menu page")).toBeTruthy();
    });
});
