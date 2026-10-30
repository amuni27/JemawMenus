// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "../ui/ToastContext";

// AGF-S2-12: the owner views, updates or removes the restaurant's Google Maps link in the business profile editor.
// Removal sends "" (D-S2-12-P1); an unchanged link isn't sent; invalid links are caught before saving; server field
// errors appear under the field.

const updateBusiness = vi.fn();
vi.mock("../../api/profileApi", () => ({ profileApi: { updateBusiness } }));
vi.mock("react-phone-number-input", () => ({
    default: (props: { placeholder?: string; value?: string; onChange: (v: string) => void }) => (
        <input aria-label={props.placeholder} value={props.value ?? ""} onChange={(e) => props.onChange(e.target.value)} />
    ),
    isValidPhoneNumber: () => true,
}));

const { default: BusinessProfileModal } = await import("./BusinessProfileModal.tsx");

const LINK = "https://maps.app.goo.gl/AbC123xyz";
const business = (locationUrl: string | null) =>
    ({ id: "b1", name: "Cafe", city: "Addis", currency: "ETB", locationUrl, createdAt: new Date(), updatedAt: new Date() });

beforeEach(() => updateBusiness.mockReset().mockResolvedValue({ data: {} }));
afterEach(() => cleanup());

function renderModal(locationUrl: string | null) {
    render(<ToastProvider><MemoryRouter><BusinessProfileModal open onClose={() => {}} onSaved={() => {}} business={business(locationUrl)} /></MemoryRouter></ToastProvider>);
}
const linkField = () => within(screen.getByText("Google Maps link").parentElement as HTMLElement).getByRole("textbox") as HTMLInputElement;
const save = () => fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

describe("business profile: Google Maps link", () => {
    it("shows the saved link and a Find on Google Maps action that opens a new tab", () => {
        renderModal(LINK);
        expect(linkField().value).toBe(LINK);
        const find = screen.getByRole("link", { name: /Find on Google Maps/ });
        expect(find.getAttribute("href")).toBe("https://www.google.com/maps");
        expect(find.getAttribute("target")).toBe("_blank");
        expect(find.getAttribute("rel")).toBe("noopener noreferrer");
    });

    it("saves a new link", async () => {
        renderModal(null);
        fireEvent.change(linkField(), { target: { value: " https://goo.gl/maps/NewCode " } });
        save();
        await waitFor(() => expect(updateBusiness).toHaveBeenCalled());
        expect(updateBusiness.mock.calls[0][1]).toMatchObject({ locationUrl: "https://goo.gl/maps/NewCode" });
    });

    it("doesn't send an unchanged link", async () => {
        renderModal(LINK);
        save();
        await waitFor(() => expect(updateBusiness).toHaveBeenCalled());
        expect(updateBusiness.mock.calls[0][1]).not.toHaveProperty("locationUrl");
    });

    it("removes the link with an empty value", async () => {
        renderModal(LINK);
        fireEvent.click(screen.getByRole("button", { name: "Remove link" }));
        expect(linkField().value).toBe("");
        save();
        await waitFor(() => expect(updateBusiness).toHaveBeenCalled());
        expect(updateBusiness.mock.calls[0][1]).toMatchObject({ locationUrl: "" });
    });

    it("stops an invalid link before saving", () => {
        renderModal(null);
        fireEvent.change(linkField(), { target: { value: "https://google.com.evil.example/maps/x" } });
        save();
        expect(screen.getByText(/Use a Google Maps share link/)).toBeTruthy();
        expect(updateBusiness).not.toHaveBeenCalled();
    });

    it("shows a server field error under the link field", async () => {
        updateBusiness.mockRejectedValueOnce({ response: { status: 400, data: { message: "Validation failed",
            fieldErrors: [{ field: "locationUrl", message: "Use a Google Maps share link (server)" }] } } });
        renderModal(null);
        fireEvent.change(linkField(), { target: { value: LINK } });
        save();
        expect(await within(screen.getByText("Google Maps link").parentElement as HTMLElement).findByText("Use a Google Maps share link (server)")).toBeTruthy();
    });
});
