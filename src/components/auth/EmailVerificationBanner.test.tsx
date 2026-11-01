// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

// AGF-S2-22: the owner-area banner shows only while verification is available and the email isn't verified; it
// mentions publishing only when the publish gate is actually on, and Resend answers honestly.

const resend = vi.fn();
vi.mock("../../api/emailVerificationApi", () => ({ emailVerificationApi: { resend } }));
const auth = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
const refresh = vi.fn();
vi.mock("../../app/context/AuthContext", () => ({ useAuth: () => auth.value }));

const { default: EmailVerificationBanner } = await import("./EmailVerificationBanner.tsx");

function withUser(emailVerification: { verified: boolean; available: boolean; publishGateEnabled: boolean } | undefined) {
    auth.value = { user: { email: "owner@example.com", emailVerification }, refresh };
}

beforeEach(() => [resend, refresh].forEach((m) => m.mockReset()));
afterEach(() => cleanup());

describe("email verification banner", () => {
    it("is hidden when verified, when verification isn't available, or when the state is unknown", () => {
        for (const state of [
            { verified: true, available: true, publishGateEnabled: true },
            { verified: false, available: false, publishGateEnabled: false },
            undefined,
        ]) {
            withUser(state);
            const { container } = render(<EmailVerificationBanner />);
            expect(container.textContent).toBe("");
            cleanup();
        }
    });

    it("mentions publishing only when the publish gate is on", () => {
        withUser({ verified: false, available: true, publishGateEnabled: true });
        render(<EmailVerificationBanner />);
        expect(screen.getByRole("status").textContent).toContain("Verify your email to publish menus.");
        expect(screen.getByRole("status").textContent).toContain("We sent a link to owner@example.com.");
        cleanup();

        withUser({ verified: false, available: true, publishGateEnabled: false });
        render(<EmailVerificationBanner />);
        expect(screen.getByRole("status").textContent).toContain("Please verify your email address.");
        expect(screen.getByRole("status").textContent).not.toMatch(/publish/i);
    });

    it("shows the server's honest answer after Resend: sent, failed or too many", async () => {
        withUser({ verified: false, available: true, publishGateEnabled: true });
        render(<EmailVerificationBanner />);
        const button = screen.getByRole("button", { name: "Resend link" });

        resend.mockResolvedValueOnce({ status: 202, data: { message: "We sent a new link to owner@example.com. It can take a few minutes; check your spam folder." } });
        fireEvent.click(button);
        expect(await screen.findByText(/We sent a new link to owner@example.com/)).toBeTruthy();

        resend.mockRejectedValueOnce({ response: { status: 503, data: { code: "EMAIL_DELIVERY_FAILED", message: "We couldn't send the email right now. Please try again in a few minutes." } } });
        fireEvent.click(button);
        expect(await screen.findByText("We couldn't send the email right now. Please try again in a few minutes.")).toBeTruthy();
        expect(screen.queryByText(/We sent a new link/)).toBeNull();

        resend.mockRejectedValueOnce({ response: { status: 429, data: { message: "Too many attempts. Try again later." } } });
        fireEvent.click(button);
        expect(await screen.findByText("Too many attempts. Try again later.")).toBeTruthy();
    });

    it("refreshes the session when the server says the email is already verified", async () => {
        withUser({ verified: false, available: true, publishGateEnabled: true });
        render(<EmailVerificationBanner />);
        resend.mockResolvedValueOnce({ status: 200, data: { message: "Your email is already verified." } });
        fireEvent.click(screen.getByRole("button", { name: "Resend link" }));
        expect(await screen.findByText("Your email is already verified.")).toBeTruthy();
        expect(refresh).toHaveBeenCalled();
    });
});
