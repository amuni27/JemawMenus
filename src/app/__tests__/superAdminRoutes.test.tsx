// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";

// AGF E4-M1: /super-admin is the platform console, not a restaurant called "super-admin" (fixed paths outrank /:tenantSlug).

vi.mock("../../app/context/AuthContext", () => ({ useAuth: () => ({ business: null, user: null, logout: vi.fn() }) }));
vi.mock("../../pages/superadmin/SuperAdminLogin.tsx", () => ({ default: () => <p>Super Admin sign-in page</p> }));
vi.mock("../../pages/customer/CustomerMenu.tsx", () => ({ default: () => <p>Guest menu page</p> }));
vi.mock("../../pages/superadmin/SuperAdminLayout.tsx", async () => {
    const { Outlet } = await import("react-router-dom");
    return { default: () => <Outlet /> };
});
vi.mock("../../pages/superadmin/SuperAdminMonetization.tsx", () => ({ default: () => <p>Monetization settings page</p> }));
vi.mock("../../pages/superadmin/SuperAdminSubscriptions.tsx", () => ({ default: () => <p>Subscriptions page</p> }));

const { routes } = await import("../routes.tsx");

afterEach(() => cleanup());

describe("Super Admin routes", () => {
    it("serves the console sign-in at /super-admin/login", async () => {
        render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ["/super-admin/login"] })} />);
        expect(await screen.findByText("Super Admin sign-in page")).toBeTruthy();
        expect(screen.queryByText("Guest menu page")).toBeNull();
    });

    it("serves the monetization settings at /super-admin/monetization (AGF E4-M2)", async () => {
        render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ["/super-admin/monetization"] })} />);
        expect(await screen.findByText("Monetization settings page")).toBeTruthy();
        expect(screen.queryByText("Guest menu page")).toBeNull();
    });

    it("serves subscriptions at /super-admin/subscriptions (AGF E4-M3)", async () => {
        render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ["/super-admin/subscriptions"] })} />);
        expect(await screen.findByText("Subscriptions page")).toBeTruthy();
        expect(screen.queryByText("Guest menu page")).toBeNull();
    });
});

