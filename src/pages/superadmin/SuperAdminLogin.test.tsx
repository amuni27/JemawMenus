// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

// AGF E4-M1 (AC11, SC5): the Super Admin sign-in page stores only the admin token and shows the server's generic error.

const login = vi.fn();
vi.mock("../../api/adminApi", async (orig) => ({ ...(await orig<typeof import("../../api/adminApi")>()), adminApi: { login } }));

const { default: SuperAdminLogin } = await import("./SuperAdminLogin.tsx");

beforeEach(() => {
    login.mockReset();
    login.mockResolvedValue({ data: { token: "t", admin: { id: "a1", email: "x" } } });
});
afterEach(() => { cleanup(); localStorage.clear(); });

function renderLogin() {
    render(
        <MemoryRouter initialEntries={["/super-admin/login"]}>
            <Routes>
                <Route path="/super-admin/login" element={<SuperAdminLogin />} />
                <Route path="/super-admin" element={<p>Console home</p>} />
            </Routes>
        </MemoryRouter>
    );
}

function submit(email: string, password: string) {
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
}

describe("Super Admin sign-in", () => {
    it("stores the admin token, leaves the owner token alone and opens the console", async () => {
        localStorage.setItem("token", "owner-token");
        login.mockResolvedValue({ data: { token: "admin-token", admin: { id: "a1", email: "root@admin.test" } } });
        renderLogin();
        expect(screen.getByRole("heading", { name: "Super Admin sign-in" })).toBeTruthy();
        submit("root@admin.test", "pw");
        expect(await screen.findByText("Console home")).toBeTruthy();
        expect(login).toHaveBeenCalledWith("root@admin.test", "pw");
        expect(localStorage.getItem("adminToken")).toBe("admin-token");
        expect(localStorage.getItem("token")).toBe("owner-token");
    });

    it("shows the server's generic message and stores nothing", async () => {
        login.mockRejectedValue({ response: { status: 400, data: { message: "Invalid credentials" } } });
        renderLogin();
        submit("someone@admin.test", "bad");
        expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Invalid credentials");
        expect(localStorage.getItem("adminToken")).toBeNull();
    });
});
