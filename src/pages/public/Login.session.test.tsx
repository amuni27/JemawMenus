// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

// AGF-S1-11: the login page explains why the session ended and returns the owner to where they were.

const login = vi.fn();
vi.mock("../../app/context/AuthContext", () => ({ useAuth: () => ({ login, loading: false }) }));

const { default: Login } = await import("./Login.tsx");

function Where() {
    const location = useLocation();
    return <p>At {location.pathname}</p>;
}

function renderLogin(search = "") {
    render(
        <MemoryRouter initialEntries={[`/auth/login${search}`]}>
            <Routes>
                <Route path="/auth/login" element={<Login />} />
                <Route path="*" element={<Where />} />
            </Routes>
        </MemoryRouter>
    );
}

function submit() {
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), { target: { value: "owner@example.com" } });
    fireEvent.change(screen.getByPlaceholderText("********"), { target: { value: "secret-pass" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
}

describe("Login page session messages and return path", () => {
    beforeEach(() => login.mockReset());
    afterEach(() => cleanup());

    it("shows the expired-session message", () => {
        renderLogin("?reason=expired");
        expect(screen.getByRole("status").textContent).toBe("Your session expired, please sign in again.");
    });

    it("shows the account-not-active message", () => {
        renderLogin("?reason=inactive");
        expect(screen.getByRole("status").textContent).toBe("Your account is not active. Contact support.");
    });

    it("shows no session message on a normal visit", () => {
        renderLogin();
        expect(screen.queryByRole("status")).toBeNull();
    });

    it("returns to the requested owner page after signing in", async () => {
        login.mockResolvedValue({ token: "t", user: {}, business: { id: "biz-1" } });
        renderLogin("?reason=expired&next=%2Fbiz-1%2Fadmin%2Fmenus%2Fm1");
        submit();
        expect(await screen.findByText("At /biz-1/admin/menus/m1")).toBeTruthy();
    });

    it.each([
        ["another restaurant's admin page", "%2Fother-biz%2Fadmin%2Fmenus"],
        ["an external site", "https%3A%2F%2Fevil.example%2F"],
        ["a protocol-relative URL", "%2F%2Fevil.example%2Fbiz-1%2Fadmin"],
        ["a non-admin page", "%2Fbiz-1%2Fmenu"],
    ])("ignores %s as the return path", async (_label, next) => {
        login.mockResolvedValue({ token: "t", user: {}, business: { id: "biz-1" } });
        renderLogin(`?next=${next}`);
        submit();
        expect(await screen.findByText("At /biz-1/admin/menus")).toBeTruthy();
    });

    it("shows the server message for an inactive account and a neutral fallback otherwise", async () => {
        login.mockRejectedValueOnce({ response: { status: 403, data: { code: "ACCOUNT_INACTIVE", message: "Account is not active. Contact support." } } });
        renderLogin();
        submit();
        expect(await screen.findByText("Account is not active. Contact support.")).toBeTruthy();

        cleanup();
        login.mockRejectedValueOnce({});
        renderLogin();
        submit();
        expect(await screen.findByText("Sign in failed. Please try again.")).toBeTruthy();
        expect(screen.queryByText(/Registration failed/)).toBeNull();
    });
});
