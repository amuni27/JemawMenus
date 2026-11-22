// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";

// AGF F4 (register §84 D5): Stripe's return and cancel URLs are fixed paths (they outrank /:tenantSlug) behind owner sign-in.

const auth = vi.hoisted(() => ({ signedIn: true }));
vi.mock("../../components/auth/RequireAuth.tsx", () => ({
    default: ({ children }: { children: React.ReactNode }) => (auth.signedIn ? <>{children}</> : <p>Login page</p>),
}));
vi.mock("../../app/context/AuthContext", () => ({ useAuth: () => ({ business: { id: "biz-1", name: "Cafe" }, user: null, logout: vi.fn() }) }));
vi.mock("../../pages/billing/CheckoutReturn.tsx", () => ({ default: () => <p>Checkout return page</p> }));
vi.mock("../../pages/billing/CheckoutCancelled.tsx", () => ({ default: () => <p>Checkout cancelled page</p> }));
vi.mock("../../pages/customer/CustomerMenu.tsx", () => ({ default: () => <p>Guest menu page</p> }));

const { routes } = await import("../routes.tsx");

afterEach(() => {
    cleanup();
    auth.signedIn = true;
});

const renderAt = (path: string) => render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);

describe("billing routes", () => {
    it.each([["/billing/return?session=cs_test_synthetic", "Checkout return page"], ["/billing/cancelled", "Checkout cancelled page"]])(
        "%s shows its page for a signed-in owner", async (path, text) => {
            renderAt(path);
            expect(await screen.findByText(text)).toBeTruthy();
            expect(screen.queryByText("Guest menu page")).toBeNull();
        });

    it.each(["/billing/return", "/billing/cancelled"])("%s needs sign-in", async (path) => {
        auth.signedIn = false;
        renderAt(path);
        expect(await screen.findByText("Login page")).toBeTruthy();
        expect(screen.queryByText(/Checkout/)).toBeNull();
    });
});
