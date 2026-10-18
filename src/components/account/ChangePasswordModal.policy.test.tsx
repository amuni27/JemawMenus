// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ToastProvider } from "../ui/ToastContext";

// AGF-S1-17: change-password applies the same complexity rules as registration.

const changePassword = vi.fn();
vi.mock("../../api/profileApi", () => ({ profileApi: { changePassword } }));

const { default: ChangePasswordModal } = await import("./ChangePasswordModal.tsx");

function fill(current: string, next: string, confirm = next) {
    const inputs = document.querySelectorAll("input[type=password]");
    fireEvent.change(inputs[0], { target: { value: current } });
    fireEvent.change(inputs[1], { target: { value: next } });
    fireEvent.change(inputs[2], { target: { value: confirm } });
}

describe("ChangePasswordModal policy", () => {
    beforeEach(() => {
        changePassword.mockReset();
        render(<ToastProvider><ChangePasswordModal open onClose={() => {}} /></ToastProvider>);
    });
    afterEach(() => cleanup());

    it("rejects a new password without the required complexity", () => {
        fill("abc123", "newpass12");
        fireEvent.click(screen.getByRole("button", { name: /save|change|update/i }));

        expect(screen.getByText(/Password must be 8-72 characters and include an uppercase letter/)).toBeTruthy();
        expect(changePassword).not.toHaveBeenCalled();
    });

    it("submits a compliant password (the current one may be a legacy password)", async () => {
        changePassword.mockResolvedValue({ data: { message: "Password changed" } });
        fill("abc123", "N3w-Passw0rd");
        fireEvent.click(screen.getByRole("button", { name: /save|change|update/i }));

        await waitFor(() => expect(changePassword).toHaveBeenCalledWith({ currentPassword: "abc123", newPassword: "N3w-Passw0rd" }));
    });

    it("shows the server's field error message when the API rejects the password", async () => {
        changePassword.mockRejectedValue({ response: { status: 400, data: { message: "Validation failed",
            fieldErrors: [{ field: "newPassword", message: "Password must be 8-72 characters and include an uppercase letter, a lowercase letter, a number and a symbol" }] } } });
        fill("abc123", "N3w-Passw0rd");
        fireEvent.click(screen.getByRole("button", { name: /save|change|update/i }));

        expect(await screen.findByText(/Password must be 8-72 characters/)).toBeTruthy();
        expect(screen.queryByText("Validation failed")).toBeNull();
    });
});
