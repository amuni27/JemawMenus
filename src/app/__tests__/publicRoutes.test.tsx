// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router-dom";

// AGF-S2-29: no invented pricing page and no blank Deals stub in the app's real route table.

vi.mock("../../components/auth/RequireAuth.tsx", () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("../../components/layout/AdminLayout.tsx", () => ({ default: () => <main><p>Admin layout</p><Outlet /></main> }));
vi.mock("../../pages/admin/Dashboard", () => ({ default: () => <p>Dashboard page</p> }));

const { routes } = await import("../routes.tsx");

afterEach(() => cleanup());

function renderAt(path: string) {
    const router = createMemoryRouter(routes, { initialEntries: [path] });
    render(<RouterProvider router={router} />);
    return router;
}

describe("public routes after the pricing and stub cleanup", () => {
    it("redirects /pricing to the home page", async () => {
        const router = renderAt("/pricing");
        expect(await screen.findByRole("link", { name: "Get started" })).toBeTruthy();
        expect(router.state.location.pathname).toBe("/");
        expect(document.body.textContent).not.toMatch(/\$\d|Starter|Enterprise|Choose/);
    });

    it("no longer serves a Deals page in the owner area", async () => {
        renderAt("/biz-1/admin/deals");
        expect(await screen.findByText(/404/)).toBeTruthy();
        expect(document.body.textContent).not.toMatch(/deal/i);
    });

    it("keeps the owner area itself working", async () => {
        renderAt("/biz-1/admin");
        expect(await screen.findByText("Dashboard page")).toBeTruthy();
    });
});
