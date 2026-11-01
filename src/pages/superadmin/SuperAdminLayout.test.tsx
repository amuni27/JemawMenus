// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

// AGF E4-M1 (AC11, SC5): the console checks the admin session with the backend; without a valid admin session it goes to
// its own sign-in page; Sign out ends only the admin session.

const me = vi.fn();
vi.mock("../../api/adminApi", async (orig) => ({ ...(await orig<typeof import("../../api/adminApi")>()), adminApi: { me } }));

const { default: SuperAdminLayout } = await import("./SuperAdminLayout.tsx");

beforeEach(() => {
    me.mockReset();
    me.mockResolvedValue({ data: { id: "a1", email: "root@admin.test", role: "ADMIN" } });
});
afterEach(() => { cleanup(); localStorage.clear(); });

function renderConsole() {
    render(
        <MemoryRouter initialEntries={["/super-admin"]}>
            <Routes>
                <Route path="/super-admin" element={<SuperAdminLayout />}>
                    <Route index element={<p>Overview page</p>} />
                </Route>
                <Route path="/super-admin/login" element={<p>Admin sign-in page</p>} />
            </Routes>
        </MemoryRouter>
    );
}

describe("Super Admin console layout", () => {
    it("goes to the admin sign-in page without an admin token, even if an owner is signed in", async () => {
        localStorage.setItem("token", "owner-token");
        renderConsole();
        expect(await screen.findByText("Admin sign-in page")).toBeTruthy();
        expect(me).not.toHaveBeenCalled();
    });

    it("shows the console for a valid admin session", async () => {
        localStorage.setItem("adminToken", "admin-token");
        me.mockResolvedValue({ data: { id: "a1", email: "root@admin.test", fullName: "Super Admin", role: "ADMIN" } });
        renderConsole();
        expect(await screen.findByText("Overview page")).toBeTruthy();
        expect(screen.getByText("root@admin.test")).toBeTruthy();
        expect(screen.getByRole("link", { name: "Overview" })).toBeTruthy();
        expect(screen.getByRole("link", { name: "Audit log" })).toBeTruthy();
    });

    it("ends the admin session when the backend refuses it (expired or not an admin)", async () => {
        localStorage.setItem("adminToken", "stale");
        localStorage.setItem("token", "owner-token");
        me.mockRejectedValue({ response: { status: 403, data: {} } });
        renderConsole();
        expect(await screen.findByText("Admin sign-in page")).toBeTruthy();
        expect(localStorage.getItem("adminToken")).toBeNull();
        expect(localStorage.getItem("token")).toBe("owner-token");
    });

    it("Sign out clears only the admin token", async () => {
        localStorage.setItem("adminToken", "admin-token");
        localStorage.setItem("token", "owner-token");
        me.mockResolvedValue({ data: { id: "a1", email: "root@admin.test", fullName: "Super Admin", role: "ADMIN" } });
        renderConsole();
        fireEvent.click(await screen.findByRole("button", { name: "Sign out" }));
        expect(await screen.findByText("Admin sign-in page")).toBeTruthy();
        expect(localStorage.getItem("adminToken")).toBeNull();
        expect(localStorage.getItem("token")).toBe("owner-token");
    });
});
