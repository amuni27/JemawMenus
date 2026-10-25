// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// AGF-S2-33: one branded, accessible not-found screen with a context-aware way forward.

vi.mock("../app/context/AuthContext", () => ({ useAuth: () => ({ business: { id: "own-biz", name: "Cafe" } }) }));

const { default: NotFound } = await import("./NotFound.tsx");

afterEach(() => cleanup());

const renderNotFound = (ui: React.ReactElement, path = "/somewhere") => render(<MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>);

describe("NotFound", () => {
    it("public: friendly heading, home action, small 404 caption, no technical detail", () => {
        renderNotFound(<NotFound context="public" />);
        expect(screen.getByRole("heading", { level: 1, name: "We can't find that page" })).toBeTruthy();
        expect(screen.getByRole("link", { name: "Go to the home page" }).getAttribute("href")).toBe("/");
        expect(screen.getByText("Error 404")).toBeTruthy();
        expect(document.body.textContent).not.toMatch(/Unexpected|stack|ErrorBoundary|developer/i);
    });

    it("restaurant: explains the menu wasn't found and offers the Agafari home page", () => {
        renderNotFound(<NotFound context="restaurant" />);
        expect(screen.getByRole("heading", { level: 1, name: "We can't find this restaurant's menu" })).toBeTruthy();
        expect(screen.getByText("Check the QR code or link, or ask the staff.")).toBeTruthy();
        expect(screen.getByRole("link", { name: "Go to the Agafari home page" }).getAttribute("href")).toBe("/");
    });

    it("item: keeps the guest in the restaurant's menu", () => {
        renderNotFound(<NotFound context="item" businessId="biz-1" />);
        expect(screen.getByRole("heading", { level: 1, name: "This dish isn't on the menu right now" })).toBeTruthy();
        expect(screen.getByRole("link", { name: "Back to the menu" }).getAttribute("href")).toBe("/biz-1/menu");
    });

    it("owner: links to the signed-in owner's own dashboard, never the URL's business", () => {
        renderNotFound(<NotFound context="owner" />, "/someone-else/admin/whatever");
        expect(screen.getByRole("heading", { level: 2, name: "We can't find that page" })).toBeTruthy();
        expect(screen.queryByRole("heading", { level: 1 })).toBeNull(); // the admin layout owns the page's h1
        expect(screen.getByRole("link", { name: "Go to your dashboard" }).getAttribute("href")).toBe("/own-biz/admin");
        expect(screen.getByRole("link", { name: "Menus" }).getAttribute("href")).toBe("/own-biz/admin/menus");
    });

    it("focuses the heading and titles the page", () => {
        renderNotFound(<NotFound context="public" />);
        expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1 }));
        expect(document.title).toBe("Page not found · Agafari");
    });
});
