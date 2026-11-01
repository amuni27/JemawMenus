// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";

// AGF E4-M1: /super-admin is the platform console, not a restaurant called "super-admin" (fixed paths outrank /:tenantSlug).

vi.mock("../../app/context/AuthContext", () => ({ useAuth: () => ({ business: null, user: null, logout: vi.fn() }) }));
vi.mock("../../pages/superadmin/SuperAdminLogin.tsx", () => ({ default: () => <p>Super Admin sign-in page</p> }));
vi.mock("../../pages/customer/CustomerMenu.tsx", () => ({ default: () => <p>Guest menu page</p> }));

const { routes } = await import("../routes.tsx");

afterEach(() => cleanup());

describe("Super Admin routes", () => {
    it("serves the console sign-in at /super-admin/login", async () => {
        render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ["/super-admin/login"] })} />);
        expect(await screen.findByText("Super Admin sign-in page")).toBeTruthy();
        expect(screen.queryByText("Guest menu page")).toBeNull();
    });
});
