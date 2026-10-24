// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

// AGF-S2-13A: "Forgot password?" → request page (same answer for every email) → reset page from the emailed link
// (token in the URL fragment, removed from the address bar) with the S1-17 password rules.

const requestReset = vi.fn();
const resetPassword = vi.fn();
vi.mock("../../api/passwordResetApi", () => ({ passwordResetApi: { request: requestReset, reset: resetPassword } }));
vi.mock("../../app/context/AuthContext", () => ({ useAuth: () => ({ login: vi.fn(), loading: false }) }));

const { default: Login } = await import("./Login.tsx");
const { default: ForgotPassword } = await import("./ForgotPassword.tsx");
const { default: ResetPassword } = await import("./ResetPassword.tsx");

// a made-up value: the page only passes it through to the API
const TOKEN = "fake-reset-link-for-tests";

beforeEach(() => [requestReset, resetPassword].forEach((m) => m.mockReset()));
afterEach(() => cleanup());

const Where = () => {
    const l = useLocation();
    return <p data-testid="where">{l.pathname + l.search + l.hash}</p>;
};

function renderAt(path: string) {
    render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path="/auth/login" element={<Login />} />
                <Route path="/auth/forgot-password" element={<ForgotPassword />} />
                <Route path="/auth/reset-password" element={<ResetPassword />} />
            </Routes>
            <Where />
        </MemoryRouter>
    );
}

const field = (label: RegExp) => screen.getByLabelText(label) as HTMLInputElement;

describe("forgot password", () => {
    it("is offered on the login page", () => {
        renderAt("/auth/login");
        expect(screen.getByRole("link", { name: "Forgot password?" }).getAttribute("href")).toBe("/auth/forgot-password");
    });

    it("sends the email and shows the same neutral confirmation for any email", async () => {
        requestReset.mockResolvedValue({ status: 202, data: { message: "server text" } });
        renderAt("/auth/forgot-password");
        fireEvent.change(field(/email/i), { target: { value: " Owner@Example.com " } });
        fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

        expect(await screen.findByRole("status")).toHaveProperty("textContent",
            "If an account exists for that email, we've sent a link to reset the password. The link expires in 30 minutes.");
        expect(requestReset).toHaveBeenCalledWith("Owner@Example.com");
        expect(screen.getByRole("link", { name: "Back to sign in" }).getAttribute("href")).toBe("/auth/login");
    });

    it("shows the rate-limit message", async () => {
        requestReset.mockRejectedValue({ response: { status: 429, data: { code: "RATE_LIMITED", message: "Too many attempts. Please wait a few minutes and try again." } } });
        renderAt("/auth/forgot-password");
        fireEvent.change(field(/email/i), { target: { value: "owner@example.com" } });
        fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
        expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Too many attempts. Please wait a few minutes and try again.");
    });
});

describe("reset password page", () => {
    it("reads the token from the link and removes it from the address bar", async () => {
        renderAt(`/auth/reset-password#token=${TOKEN}`);
        await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/auth/reset-password"));
        expect(document.body.textContent).not.toContain(TOKEN);
        expect(field(/^new password/i)).toBeTruthy();
    });

    it("checks the S1-17 rules and the confirmation before sending", async () => {
        resetPassword.mockResolvedValue({ data: { message: "ok" } });
        renderAt(`/auth/reset-password#token=${TOKEN}`);
        const submit = () => screen.getByRole("button", { name: "Set new password" }) as HTMLButtonElement;

        fireEvent.change(field(/^new password/i), { target: { value: "weak" } });
        expect(screen.getByText(/At least 8 characters/).textContent).toMatch(/^•/);
        expect(submit().disabled).toBe(true);

        fireEvent.change(field(/^new password/i), { target: { value: "N3w-Secure-Pass!" } });
        fireEvent.change(field(/confirm/i), { target: { value: "N3w-Secure-Pass?" } });
        expect(screen.getByText("Passwords don't match")).toBeTruthy();
        expect(submit().disabled).toBe(true);

        fireEvent.change(field(/confirm/i), { target: { value: "N3w-Secure-Pass!" } });
        expect(submit().disabled).toBe(false);
        fireEvent.click(submit());

        await waitFor(() => expect(resetPassword).toHaveBeenCalledWith(TOKEN, "N3w-Secure-Pass!"));
        expect(await screen.findByText("Your password has been changed. Sign in with your new password.")).toBeTruthy();
        expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/auth/login");
    });

    it("offers a new link for an expired, used or tampered link", async () => {
        resetPassword.mockRejectedValue({ response: { status: 400, data: { code: "RESET_LINK_INVALID", message: "This reset link is invalid or has expired. Request a new link." } } });
        renderAt(`/auth/reset-password#token=${TOKEN}`);
        fireEvent.change(field(/^new password/i), { target: { value: "N3w-Secure-Pass!" } });
        fireEvent.change(field(/confirm/i), { target: { value: "N3w-Secure-Pass!" } });
        fireEvent.click(screen.getByRole("button", { name: "Set new password" }));

        expect(await screen.findByText("This reset link is invalid or has expired.")).toBeTruthy();
        expect(screen.getByRole("link", { name: "Request a new link" }).getAttribute("href")).toBe("/auth/forgot-password");
        expect(screen.queryByLabelText(/^new password/i)).toBeNull();
    });

    it("treats a missing token as an invalid link without calling the API", () => {
        renderAt("/auth/reset-password");
        expect(screen.getByText("This reset link is invalid or has expired.")).toBeTruthy();
        expect(screen.getByRole("link", { name: "Request a new link" })).toBeTruthy();
        expect(resetPassword).not.toHaveBeenCalled();
    });

    it("shows a backend password error under the field", async () => {
        resetPassword.mockRejectedValue({ response: { status: 400, data: { message: "Validation failed",
            fieldErrors: [{ field: "newPassword", message: "Password must be 8-72 characters and include an uppercase letter, a lowercase letter, a number and a symbol" }] } } });
        renderAt(`/auth/reset-password#token=${TOKEN}`);
        fireEvent.change(field(/^new password/i), { target: { value: "N3w-Secure-Pass!" } });
        fireEvent.change(field(/confirm/i), { target: { value: "N3w-Secure-Pass!" } });
        fireEvent.click(screen.getByRole("button", { name: "Set new password" }));

        expect(await screen.findByText(/^Password must be 8-72 characters/)).toBeTruthy();
        expect(screen.queryByText("Validation failed")).toBeNull();
        expect(field(/^new password/i)).toBeTruthy(); // the link is still usable
    });

    it("explains when reset is not available on the server", async () => {
        resetPassword.mockRejectedValue({ response: { status: 503, data: { code: "RESET_UNAVAILABLE", message: "Password reset is not available right now. Please contact support." } } });
        renderAt(`/auth/reset-password#token=${TOKEN}`);
        fireEvent.change(field(/^new password/i), { target: { value: "N3w-Secure-Pass!" } });
        fireEvent.change(field(/confirm/i), { target: { value: "N3w-Secure-Pass!" } });
        fireEvent.click(screen.getByRole("button", { name: "Set new password" }));
        expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Password reset is not available right now. Please contact support.");
    });
});
