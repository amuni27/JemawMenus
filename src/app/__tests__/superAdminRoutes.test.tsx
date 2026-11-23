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
vi.mock("../../pages/superadmin/SuperAdminPlanRequests.tsx", () => ({ default: () => <p>Plan requests page</p> }));
vi.mock("../../pages/superadmin/SuperAdminPrices.tsx", () => ({ default: () => <p>Plan prices page</p> }));
vi.mock("../../pages/superadmin/SuperAdminExceptions.tsx", () => ({ default: () => <p>Exceptions page</p> }));
vi.mock("../../pages/superadmin/SuperAdminExceptionDetail.tsx", () => ({ default: () => <p>Exception detail page</p> }));

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

    it("serves exceptions at /super-admin/exceptions and one at /super-admin/exceptions/:id (AGF EX-F)", async () => {
        render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ["/super-admin/exceptions"] })} />);
        expect(await screen.findByText("Exceptions page")).toBeTruthy();
        cleanup();
        render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ["/super-admin/exceptions/ex-1"] })} />);
        expect(await screen.findByText("Exception detail page")).toBeTruthy();
    });

    it("serves plan prices at /super-admin/prices (AGF SA-P1)", async () => {
        render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ["/super-admin/prices"] })} />);
        expect(await screen.findByText("Plan prices page")).toBeTruthy();
    });

    it("serves plan requests at /super-admin/plan-requests (AGF E4-M4)", async () => {
        render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ["/super-admin/plan-requests"] })} />);
        expect(await screen.findByText("Plan requests page")).toBeTruthy();
    });
});

