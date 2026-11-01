// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

// AGF-S2-22 (AC10): the page opened from a verification link /auth/verify-email#token=…  The token stays in the URL
// fragment (never sent to a server), is removed from the address bar, and is submitted once.

const verify = vi.fn();
vi.mock("../../api/emailVerificationApi", () => ({ emailVerificationApi: { verify } }));
const refresh = vi.fn();
const auth = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock("../../app/context/AuthContext", () => ({ useAuth: () => auth.value }));

const { default: VerifyEmail } = await import("./VerifyEmail.tsx");

const TOKEN = "fake-verification-link-for-tests";

beforeEach(() => {
    [verify, refresh].forEach((m) => m.mockReset());
    auth.value = { user: null, refresh };
});
afterEach(() => cleanup());

const Where = () => {
    const l = useLocation();
    return <p data-testid="where">{l.pathname + l.hash}</p>;
};

function renderAt(path: string) {
    render(
        <MemoryRouter initialEntries={[path]}>
            <Routes><Route path="/auth/verify-email" element={<VerifyEmail />} /></Routes>
            <Where />
        </MemoryRouter>
    );
}

describe("verify email page", () => {
    it("verifies with the token from the fragment, once, and removes it from the address bar", async () => {
        verify.mockResolvedValue({ data: { status: "VERIFIED", message: "Your email is verified." } });
        renderAt(`/auth/verify-email#token=${TOKEN}`);
        expect(await screen.findByRole("heading", { name: "Email verified" })).toBeTruthy();
        expect(verify).toHaveBeenCalledTimes(1);
        expect(verify).toHaveBeenCalledWith(TOKEN);
        await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/auth/verify-email"));
    });

    it("treats an already verified email as success, not an error", async () => {
        verify.mockResolvedValue({ data: { status: "ALREADY_VERIFIED", message: "Your email is already verified." } });
        renderAt(`/auth/verify-email#token=${TOKEN}`);
        expect(await screen.findByRole("heading", { name: "Email already verified" })).toBeTruthy();
    });

    it("refreshes a signed-in owner's session so the banner disappears", async () => {
        auth.value = { user: { email: "owner@example.com" }, refresh };
        verify.mockResolvedValue({ data: { status: "VERIFIED" } });
        renderAt(`/auth/verify-email#token=${TOKEN}`);
        await screen.findByRole("heading", { name: "Email verified" });
        expect(refresh).toHaveBeenCalled();
    });

    it("sends a signed-in owner to their menus, not to the sign-in form", async () => {
        auth.value = { user: { email: "owner@example.com" }, business: { id: "biz-1" }, refresh };
        verify.mockResolvedValue({ data: { status: "VERIFIED" } });
        renderAt(`/auth/verify-email#token=${TOKEN}`);
        const link = await screen.findByRole("link", { name: "Go to your menus" });
        expect(link.getAttribute("href")).toBe("/biz-1/admin/menus");
    });

    it("offers sign-in to someone who isn't signed in, with an AA-contrast button", async () => {
        verify.mockResolvedValue({ data: { status: "VERIFIED" } });
        renderAt(`/auth/verify-email#token=${TOKEN}`);
        const link = await screen.findByRole("link", { name: "Sign in" });
        expect(link.getAttribute("href")).toBe("/auth/login");
        expect(link.className.split(/\s+/)).toContain("bg-brand-dark"); // white on brand-dark is 4.7:1 (axe: brand is 3.5:1)
    });

    it("explains an expired or invalid link and how to get a new one", async () => {
        verify.mockRejectedValue({ response: { status: 400, data: { code: "VERIFY_LINK_INVALID" } } });
        renderAt(`/auth/verify-email#token=${TOKEN}`);
        expect(await screen.findByText("This verification link has expired or is invalid.")).toBeTruthy();
        expect(screen.getByText(/Sign in and choose .Resend link./)).toBeTruthy();
    });

    it("says when verification isn't available", async () => {
        verify.mockRejectedValue({ response: { status: 503, data: { code: "EMAIL_VERIFICATION_UNAVAILABLE" } } });
        renderAt(`/auth/verify-email#token=${TOKEN}`);
        expect(await screen.findByText("Email verification isn't available right now. Please try again later.")).toBeTruthy();
    });

    it("handles a link without a token without calling the server", async () => {
        renderAt("/auth/verify-email");
        expect(await screen.findByText("This verification link has expired or is invalid.")).toBeTruthy();
        expect(verify).not.toHaveBeenCalled();
    });
});
