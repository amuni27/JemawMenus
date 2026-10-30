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
    default: (props: { placeholder?: string; value?: string; countries?: string[]; onChange: (v: string) => void }) => (
        <input aria-label={props.placeholder ?? "Business phone"} data-countries={props.countries?.join(",")} value={props.value ?? ""}
               onChange={(e) => props.onChange(e.target.value)} />
    ),
    isValidPhoneNumber: () => true,
}));

const { default: BusinessProfileModal } = await import("./BusinessProfileModal.tsx");

const LINK = "https://maps.app.goo.gl/AbC123xyz";
// CR1: Ethiopian unless another country is given; US restaurants carry a full address
const business = (locationUrl: string | null, country?: "ET" | "US") =>
    ({ id: "b1", name: "Cafe", city: country === "US" ? "New York" : "Addis", currency: "ETB", locationUrl, createdAt: new Date(), updatedAt: new Date(),
       ...(country === "US" ? { country, businessPhone: "+12125550100", streetAddress: "350 5th Ave", state: "NY", zipcode: "10118" } : country ? { country } : {}) });

beforeEach(() => updateBusiness.mockReset().mockResolvedValue({ data: {} }));
afterEach(() => cleanup());

function renderModal(locationUrl: string | null, country?: "ET" | "US") {
    render(<ToastProvider><MemoryRouter><BusinessProfileModal open onClose={() => {}} onSaved={() => {}} business={business(locationUrl, country)} /></MemoryRouter></ToastProvider>);
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

    it("removes the link with an empty value (United States)", async () => {
        renderModal(LINK, "US");
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

// AGF-S2-12 CR1: the editor follows the restaurant's stored country; the country itself isn't editable (D-CR1-4)
describe("business profile: country rules", () => {
    const linkBox = () => screen.getByText(/^Google Maps link/).parentElement as HTMLElement;

    it("Ethiopia: no address fields, an Ethiopian phone, and the country shown read-only", () => {
        renderModal(LINK, "ET");
        for (const label of ["Street Address", "City", "Region", "State", "Postal Code", "ZIP Code"]) expect(screen.queryByText(label)).toBeNull();
        expect(screen.getByText("Ethiopia")).toBeTruthy();
        expect(screen.queryByRole("combobox", { name: /Country/ })).toBeNull();
        expect((screen.getByLabelText("Business phone") as HTMLInputElement).dataset.countries).toBe("ET");
    });

    it("Ethiopia: a saved link can be replaced but not removed (D-CR1-5)", () => {
        renderModal(LINK, "ET");
        expect(screen.queryByRole("button", { name: "Remove link" })).toBeNull();
        fireEvent.change(linkField(), { target: { value: "" } });
        save();
        expect(within(linkBox()).getByText(/need a Google Maps link/)).toBeTruthy();
        expect(updateBusiness).not.toHaveBeenCalled();
    });

    it("Ethiopia: a restaurant without a link can still save other changes, and sends no address", async () => {
        renderModal(null, "ET");
        expect(screen.getByText(/Required for restaurants in Ethiopia/)).toBeTruthy();
        save();
        await waitFor(() => expect(updateBusiness).toHaveBeenCalled());
        for (const key of ["streetAddress", "city", "state", "zipcode"]) expect(updateBusiness.mock.calls[0][1]).not.toHaveProperty(key);
    });

    it("United States: street, city, state and ZIP with a US phone; the state is a list", () => {
        renderModal(null, "US");
        expect(screen.getByText("United States")).toBeTruthy();
        expect((screen.getByLabelText("State") as HTMLSelectElement).value).toBe("NY");
        for (const label of ["Street Address", "City", "ZIP Code"]) expect(screen.getByText(label)).toBeTruthy();
        expect(screen.queryByText("Region")).toBeNull();
        expect((screen.getByLabelText("Business phone") as HTMLInputElement).dataset.countries).toBe("US");
    });

    it("United States: blank or invalid address fields are caught before saving", () => {
        renderModal(null, "US");
        fireEvent.change(within(screen.getByText("ZIP Code").parentElement as HTMLElement).getByRole("textbox"), { target: { value: "1011" } });
        fireEvent.change(within(screen.getByText("City").parentElement as HTMLElement).getByRole("textbox"), { target: { value: " " } });
        save();
        expect(screen.getByText(/12345 or 12345-6789/)).toBeTruthy();
        expect(screen.getByText("City is required.")).toBeTruthy();
        expect(updateBusiness).not.toHaveBeenCalled();
    });

    it("United States: sends the address with the state code", async () => {
        renderModal(null, "US");
        fireEvent.change(screen.getByLabelText("State"), { target: { value: "CA" } });
        save();
        await waitFor(() => expect(updateBusiness).toHaveBeenCalled());
        expect(updateBusiness.mock.calls[0][1]).toMatchObject({ streetAddress: "350 5th Ave", city: "New York", state: "CA", zipcode: "10118" });
    });
});
