// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "../../components/ui/ToastContext";

// AGF-S2-12: registration offers "Find Location on Google Maps" and an optional link field; the sub-city, woreda,
// kebele and house-number inputs are gone (D-S2-12-1) and are no longer sent.

const register = vi.fn();
vi.mock("../../app/context/AuthContext", () => ({ useAuth: () => ({ register, loading: false }) }));
vi.mock("react-phone-number-input", () => ({
    default: (props: { placeholder?: string; value?: string; onChange: (v: string) => void }) => (
        <input aria-label={props.placeholder} value={props.value ?? ""} onChange={(e) => props.onChange(e.target.value)} />
    ),
    isValidPhoneNumber: () => true,
}));

const { default: RegisterWizard } = await import("./RegisterWizard.tsx");

beforeEach(() => register.mockReset().mockResolvedValue(undefined));
afterEach(() => cleanup());

const fieldBox = (label: string) => screen.getByText(label).parentElement as HTMLElement;
const typeInto = (label: string, value: string) => fireEvent.change(within(fieldBox(label)).getByRole("textbox"), { target: { value } });

function toBusinessStep() {
    render(<ToastProvider><MemoryRouter><RegisterWizard /></MemoryRouter></ToastProvider>);
    typeInto("Full Name *", "Demo Owner");
    typeInto("Email *", "owner@example.com");
    const pw = document.querySelectorAll("input[type=password]");
    fireEvent.change(pw[0], { target: { value: "Str0ng!Pass" } });
    fireEvent.change(pw[1], { target: { value: "Str0ng!Pass" } });
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    typeInto("Business Name *", "Cafe");
    fireEvent.change(screen.getByLabelText("Enter business phone number"), { target: { value: "+251911000000" } });
    typeInto("Street Address *", "1 Road");
    typeInto("City *", "Addis Ababa");
    typeInto("Region *", "Addis Ababa");
}

function finish() {
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    typeInto("Restaurant short name *", "abol-cafe");
    fireEvent.click(screen.getByRole("button", { name: /complete|finish|create|register/i }));
}

describe("registration: Google Maps link", () => {
    it("has no sub-city, woreda, kebele or house-number inputs", () => {
        toBusinessStep();
        for (const label of [/Sub-City/i, /Woreda/i, /Kebele/i, /House No/i]) expect(screen.queryByText(label)).toBeNull();
    });

    it("offers Find Location on Google Maps in a new tab and an optional link field", () => {
        toBusinessStep();
        const find = screen.getByRole("link", { name: /Find Location on Google Maps/ });
        expect(find.getAttribute("href")).toBe("https://www.google.com/maps");
        expect(find.getAttribute("target")).toBe("_blank");
        expect(find.getAttribute("rel")).toBe("noopener noreferrer");
        expect(screen.getByText("Google Maps link (optional)")).toBeTruthy();
    });

    it("registers without a link and sends no legacy address fields", async () => {
        toBusinessStep();
        finish();
        await waitFor(() => expect(register).toHaveBeenCalled());
        const payload = register.mock.calls[0][0];
        expect(payload.locationUrl).toBeUndefined();
        for (const key of ["subCity", "woreda", "kebele", "houseNumber"]) expect(payload).not.toHaveProperty(key);
    });

    it("sends a pasted link", async () => {
        toBusinessStep();
        typeInto("Google Maps link (optional)", " https://maps.app.goo.gl/AbC123xyz ");
        finish();
        await waitFor(() => expect(register).toHaveBeenCalled());
        expect(register.mock.calls[0][0].locationUrl).toBe("https://maps.app.goo.gl/AbC123xyz");
    });

    it("explains an invalid link and stays on the step", () => {
        toBusinessStep();
        typeInto("Google Maps link (optional)", "https://google.com.evil.example/maps/x");
        fireEvent.click(screen.getByRole("button", { name: /next/i }));
        expect(within(fieldBox("Google Maps link (optional)")).getByText(/Use a Google Maps share link/)).toBeTruthy();
        expect(screen.queryByText("Restaurant short name *")).toBeNull();
    });

    it("returns to the business step with the server's field error under the link", async () => {
        register.mockRejectedValueOnce({ response: { status: 400, data: { message: "Validation failed",
            fieldErrors: [{ field: "locationUrl", message: "Use a Google Maps share link (server)" }] } } });
        toBusinessStep();
        typeInto("Google Maps link (optional)", "https://maps.app.goo.gl/AbC123xyz");
        finish();
        expect(await within(await waitFor(() => fieldBox("Google Maps link (optional)"))).findByText("Use a Google Maps share link (server)")).toBeTruthy();
    });
});
