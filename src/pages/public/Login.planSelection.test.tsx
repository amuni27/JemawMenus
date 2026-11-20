// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

// AGF FE-2 (register §49/§50): after signing in without a page to return to, an owner whose plan view says
// `selectionRequired: true` lands on Subscription & Plans; everyone else lands on Menus as before. The backend decides;
// a failed or slow plan read never blocks sign-in. A return page (`next`) always wins and the plan isn't read.

const login = vi.fn();
vi.mock("../../app/context/AuthContext", () => ({ useAuth: () => ({ login, loading: false }) }));
const get = vi.fn();
vi.mock("../../api/planApi", () => ({ default: { get } }));

const { default: Login } = await import("./Login.tsx");
const { PLAN_CHECK_TIMEOUT_MS } = await import("../../services/planSelection.ts");

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

beforeEach(() => {
    login.mockReset();
    get.mockReset();
    login.mockResolvedValue({ token: "t", user: {}, business: { id: "biz-1" } });
});
afterEach(() => cleanup());

describe("Login lands a new restaurant on Subscription & Plans", () => {
    it("goes to Subscription & Plans when the backend says a plan must be chosen", async () => {
        get.mockResolvedValue({ data: { visible: true, setting: "SETTING_2", selectionRequired: true } });
        renderLogin();
        submit();
        expect(await screen.findByText("At /biz-1/admin/plans")).toBeTruthy();
        expect(get).toHaveBeenCalledTimes(1);
    });

    it.each([
        ["not required", { visible: true, setting: "SETTING_2", selectionRequired: false }],
        ["absent (cut-over not configured)", { visible: true, setting: "SETTING_1" }],
        ["plans hidden", { visible: false }],
        ["required but plans hidden", { visible: false, selectionRequired: true }],
    ])("goes to Menus when the signal is %s", async (_label, data) => {
        get.mockResolvedValue({ data });
        renderLogin();
        submit();
        expect(await screen.findByText("At /biz-1/admin/menus")).toBeTruthy();
    });

    it("goes to Menus when the plan can't be read", async () => {
        get.mockRejectedValue(new Error("network"));
        renderLogin();
        submit();
        expect(await screen.findByText("At /biz-1/admin/menus")).toBeTruthy();
    });

    it("goes to Menus when the plan read is too slow", async () => {
        get.mockReturnValue(new Promise(() => {}));
        renderLogin();
        submit();
        expect(await screen.findByText("At /biz-1/admin/menus", undefined, { timeout: PLAN_CHECK_TIMEOUT_MS + 2000 })).toBeTruthy();
    }, PLAN_CHECK_TIMEOUT_MS + 5000);

    it("returns to the requested page without reading the plan", async () => {
        get.mockResolvedValue({ data: { visible: true, selectionRequired: true } });
        renderLogin("?reason=expired&next=%2Fbiz-1%2Fadmin%2Fmenus%2Fm1");
        submit();
        expect(await screen.findByText("At /biz-1/admin/menus/m1")).toBeTruthy();
        expect(get).not.toHaveBeenCalled();
    });

    it("still goes home for an account without a restaurant", async () => {
        login.mockResolvedValue({ token: "t", user: {}, business: null });
        renderLogin();
        submit();
        expect(await screen.findByText("At /")).toBeTruthy();
        expect(get).not.toHaveBeenCalled();
    });
});
