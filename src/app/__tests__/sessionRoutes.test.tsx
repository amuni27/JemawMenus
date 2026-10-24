// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

// AGF-S1-11: owner pages are guarded; guest pages never redirect to login, even with a stale token.

const me = vi.fn();
vi.mock("../../services/authService", async (importOriginal) => ({
    ...(await importOriginal<object>()),
    me,
}));

const { AuthProvider } = await import("../context/AuthContext.tsx");
const { default: RequireAuth } = await import("../../components/auth/RequireAuth.tsx");
const { ToastProvider } = await import("../../components/ui/ToastContext.tsx");
const { SESSION_ENDED_EVENT, ACCESS_DENIED_EVENT } = await import("../../services/session.ts");

const adminRendered = vi.fn();

function Admin() {
    adminRendered();
    return <p>Admin menus</p>;
}

function LoginProbe() {
    const location = useLocation();
    return <p>Login page {location.search}</p>;
}

function renderAt(path: string) {
    return render(
        <ToastProvider>
            <AuthProvider>
                <MemoryRouter initialEntries={[path]}>
                    <Routes>
                        <Route path="/auth/login" element={<LoginProbe />} />
                        <Route path="/:tenantSlug/menu" element={<p>Guest menu</p>} />
                        <Route path="/:tenantSlug/admin/*" element={<RequireAuth><Admin /></RequireAuth>} />
                    </Routes>
                </MemoryRouter>
            </AuthProvider>
        </ToastProvider>
    );
}

const USER = { id: "u1", email: "owner@example.com", fullName: "Owner" };
const BUSINESS = { id: "biz-1", name: "Cafe" };
const httpError = (status: number, code?: string) =>
    Object.assign(new Error(String(status)), { response: { status, data: code ? { code } : {} } });

function storeSession(token: string) {
    localStorage.setItem("token", token);
    localStorage.setItem("session", JSON.stringify({ token, user: USER, business: BUSINESS }));
}

describe("route guards and session handling", () => {
    beforeEach(() => {
        me.mockReset();
        adminRendered.mockReset();
        localStorage.clear();
    });

    afterEach(() => cleanup());

    it("stores the new token returned by /me (refresh)", async () => {
        storeSession("old-token");
        me.mockResolvedValue({ token: "new-token", user: USER, business: BUSINESS });

        renderAt("/biz-1/admin/menus");

        expect(await screen.findByText("Admin menus")).toBeTruthy();
        expect(localStorage.getItem("token")).toBe("new-token");
        expect(JSON.parse(localStorage.getItem("session")!).token).toBe("new-token");
    });

    it("redirects a logged-out visitor to login without rendering the admin page", async () => {
        renderAt("/biz-1/admin/menus");

        expect(await screen.findByText(/Login page/)).toBeTruthy();
        expect(screen.getByText(/Login page/).textContent).toContain("next=%2Fbiz-1%2Fadmin%2Fmenus");
        expect(screen.getByText(/Login page/).textContent).not.toContain("reason=");
        expect(adminRendered).not.toHaveBeenCalled();
        expect(me).not.toHaveBeenCalled();
    });

    it("shows a loading state, not the admin page, while the session is being checked", async () => {
        storeSession("some-token");
        let resolve!: (v: unknown) => void;
        me.mockReturnValue(new Promise((r) => (resolve = r)));

        renderAt("/biz-1/admin/menus");

        expect(screen.getByRole("status").textContent).toContain("Checking your session");
        expect(adminRendered).not.toHaveBeenCalled();
        await act(async () => resolve({ token: "fresh", user: USER, business: BUSINESS }));
        expect(await screen.findByText("Admin menus")).toBeTruthy();
    });

    it("an expired stored token on an owner page leads to login with the expired reason", async () => {
        storeSession("expired-token");
        me.mockRejectedValue(httpError(401, "AUTH_REQUIRED"));

        renderAt("/biz-1/admin/menus");

        const login = await screen.findByText(/Login page/);
        expect(login.textContent).toContain("reason=expired");
        expect(login.textContent).toContain("next=%2Fbiz-1%2Fadmin%2Fmenus");
        expect(adminRendered).not.toHaveBeenCalled();
        expect(localStorage.getItem("token")).toBeNull();
    });

    it("an inactive account on an owner page leads to login with the inactive reason", async () => {
        storeSession("valid-token");
        me.mockRejectedValue(httpError(403, "ACCOUNT_INACTIVE"));

        renderAt("/biz-1/admin/menus");

        expect((await screen.findByText(/Login page/)).textContent).toContain("reason=inactive");
        expect(localStorage.getItem("token")).toBeNull();
    });

    it("a stale stored token never redirects a guest away from the menu", async () => {
        storeSession("expired-token");
        me.mockRejectedValue(httpError(401, "AUTH_REQUIRED"));

        renderAt("/biz-1/menu");

        expect(await screen.findByText("Guest menu")).toBeTruthy();
        await act(async () => {
            await Promise.resolve();
        });
        expect(screen.queryByText(/Login page/)).toBeNull();
        expect(screen.getByText("Guest menu")).toBeTruthy();
        expect(localStorage.getItem("token")).toBeNull(); // stale token is cleaned up silently
    });

    it("the guest menu needs no login at all", async () => {
        renderAt("/biz-1/menu");
        expect(await screen.findByText("Guest menu")).toBeTruthy();
        expect(me).not.toHaveBeenCalled();
    });

    it("a 401 from any admin API call ends the session and shows login with the expired reason", async () => {
        storeSession("valid-token");
        me.mockResolvedValue({ token: "valid-token", user: USER, business: BUSINESS });
        renderAt("/biz-1/admin/menus/m1");
        expect(await screen.findByText("Admin menus")).toBeTruthy();

        await act(async () => {
            localStorage.clear(); // the interceptor clears storage before announcing the end of the session
            window.dispatchEvent(new CustomEvent(SESSION_ENDED_EVENT, { detail: { reason: "expired" } }));
        });

        const login = await screen.findByText(/Login page/);
        expect(login.textContent).toContain("reason=expired");
        expect(login.textContent).toContain("next=%2Fbiz-1%2Fadmin%2Fmenus%2Fm1");
    });

    it("access denied keeps the owner signed in and shows a message", async () => {
        storeSession("valid-token");
        me.mockResolvedValue({ token: "valid-token", user: USER, business: BUSINESS });
        renderAt("/biz-1/admin/menus");
        expect(await screen.findByText("Admin menus")).toBeTruthy();

        await act(async () => {
            window.dispatchEvent(new CustomEvent(ACCESS_DENIED_EVENT, { detail: { message: "You don't have access to this resource" } }));
        });

        expect(await screen.findByText("You don't have access to this resource")).toBeTruthy();
        expect(screen.getByText("Admin menus")).toBeTruthy();
        expect(localStorage.getItem("token")).toBe("valid-token");
    });
});
