// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "../../components/ui/ToastContext";

// AGF-S1-19: a 429 RATE_LIMITED response is shown to the user as the server's message (no logout, no generic text).

const RATE_LIMITED = {
    response: { status: 429, headers: { "retry-after": "600" },
        data: { status: 429, code: "RATE_LIMITED", message: "Too many attempts. Please wait a few minutes and try again." } },
};

const login = vi.fn();
vi.mock("../../app/context/AuthContext", () => ({ useAuth: () => ({ login, loading: false }) }));
const changePassword = vi.fn();
vi.mock("../../api/profileApi", () => ({ profileApi: { changePassword } }));

const { default: Login } = await import("./Login.tsx");
const { default: ChangePasswordModal } = await import("../../components/account/ChangePasswordModal.tsx");

afterEach(() => cleanup());

describe("rate-limit message", () => {
    it("login shows the RATE_LIMITED message", async () => {
        login.mockRejectedValue(RATE_LIMITED);
        render(<MemoryRouter><Login /></MemoryRouter>);
        fireEvent.change(screen.getByPlaceholderText("you@example.com"), { target: { value: "owner@example.com" } });
        fireEvent.change(screen.getByPlaceholderText("********"), { target: { value: "whatever" } });
        fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

        expect(await screen.findByText("Too many attempts. Please wait a few minutes and try again.")).toBeTruthy();
    });

    it("change password shows the RATE_LIMITED message", async () => {
        changePassword.mockRejectedValue(RATE_LIMITED);
        render(<ToastProvider><ChangePasswordModal open onClose={() => {}} /></ToastProvider>);
        const inputs = document.querySelectorAll("input[type=password]");
        fireEvent.change(inputs[0], { target: { value: "Current-Pass1" } });
        fireEvent.change(inputs[1], { target: { value: "N3w-Passw0rd" } });
        fireEvent.change(inputs[2], { target: { value: "N3w-Passw0rd" } });
        fireEvent.click(screen.getByRole("button", { name: /save|change|update/i }));

        expect(await screen.findByText("Too many attempts. Please wait a few minutes and try again.")).toBeTruthy();
    });
});
