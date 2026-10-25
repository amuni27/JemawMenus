// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";

// AGF-S2-33: the root error element shows a 404 as not-found and anything else as a generic message,
// never the error's details.

const { default: RouteError } = await import("./RouteError.tsx");

afterEach(() => cleanup());

function renderThrowing(thrown: unknown) {
    const Boom = () => { throw thrown; };
    const router = createMemoryRouter([{ path: "/", element: <Boom />, errorElement: <RouteError /> }], { initialEntries: ["/"] });
    render(<RouterProvider router={router} />);
}

describe("RouteError", () => {
    it("shows the not-found screen for the router's own 404 (no matching route)", async () => {
        const router = createMemoryRouter([{ path: "/", element: <p>Home</p>, errorElement: <RouteError /> }], { initialEntries: ["/missing"] });
        render(<RouterProvider router={router} />);
        expect(await screen.findByRole("heading", { level: 1, name: "We can't find that page" })).toBeTruthy();
    });

    it("shows a generic message without details for other errors", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        renderThrowing(new Error("secret stack detail"));
        expect(await screen.findByRole("heading", { level: 1, name: "Something went wrong" })).toBeTruthy();
        expect(screen.getByRole("link", { name: "Go to the home page" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "Reload" })).toBeTruthy();
        expect(document.body.textContent).not.toContain("secret stack detail");
    });
});
