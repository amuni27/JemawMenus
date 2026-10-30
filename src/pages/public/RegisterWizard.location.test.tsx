// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "../../components/ui/ToastContext";

// AGF-S2-12 + CR1: the business step follows the selected country (D-CR1-1). Ethiopia: only the Google Maps link,
// required, with "Find Location on Google Maps". United States: street, city, state and ZIP, all required; the link
// is optional. Switching country swaps the fields and only the selected country's fields are sent.

const register = vi.fn();
vi.mock("../../app/context/AuthContext", () => ({ useAuth: () => ({ register, loading: false }) }));
vi.mock("react-phone-number-input", () => ({
    default: (props: { placeholder?: string; value?: string; countries?: string[]; onChange: (v: string) => void }) => (
        <input aria-label={props.placeholder} data-countries={props.countries?.join(",")} value={props.value ?? ""}
               onChange={(e) => props.onChange(e.target.value)} />
    ),
    isValidPhoneNumber: () => true,
}));

const { default: RegisterWizard } = await import("./RegisterWizard.tsx");

beforeEach(() => register.mockReset().mockResolvedValue(undefined));
afterEach(() => cleanup());

const LINK = "https://maps.app.goo.gl/AbC123xyz";
const fieldBox = (label: string) => screen.getByText(label).parentElement as HTMLElement;
const typeInto = (label: string, value: string) => fireEvent.change(within(fieldBox(label)).getByRole("textbox"), { target: { value } });
const businessPhone = () => screen.getByLabelText("Enter business phone number") as HTMLInputElement;
const next = () => screen.getByRole("button", { name: /next/i }) as HTMLButtonElement;
const chooseCountry = (code: "ET" | "US") => fireEvent.change(screen.getByLabelText("Country *"), { target: { value: code } });

function toBusinessStep() {
    render(<ToastProvider><MemoryRouter><RegisterWizard /></MemoryRouter></ToastProvider>);
    typeInto("Full Name *", "Demo Owner");
    typeInto("Email *", "owner@example.com");
    const pw = document.querySelectorAll("input[type=password]");
    fireEvent.change(pw[0], { target: { value: "Str0ng!Pass" } });
    fireEvent.change(pw[1], { target: { value: "Str0ng!Pass" } });
    fireEvent.click(next());
    typeInto("Business Name *", "Cafe");
}

function fillEthiopia() {
    fireEvent.change(businessPhone(), { target: { value: "+251911000000" } });
    typeInto("Google Maps link *", ` ${LINK} `);
}

function fillUnitedStates() {
    chooseCountry("US");
    fireEvent.change(businessPhone(), { target: { value: "+12125550100" } });
    typeInto("Street Address *", " 350 5th Ave ");
    typeInto("City *", "New York");
    fireEvent.change(screen.getByLabelText("State *"), { target: { value: "NY" } });
    typeInto("ZIP Code *", "10118");
}

function finish() {
    fireEvent.click(next());
    typeInto("Restaurant short name *", "abol-cafe");
    fireEvent.click(screen.getByRole("button", { name: /complete|finish|create|register/i }));
}

const ADDRESS_KEYS = ["streetAddress", "city", "state", "zipcode", "subCity", "woreda", "kebele", "houseNumber"];

describe("registration: Ethiopia (default)", () => {
    it("shows only the Google Maps link, required, with Find Location on Google Maps", () => {
        toBusinessStep();
        expect((screen.getByLabelText("Country *") as HTMLSelectElement).value).toBe("ET");
        for (const label of [/Street Address/, /^City/, /Region/, /^State/, /Postal Code/, /ZIP Code/, /Sub-City/i, /Woreda/i, /Kebele/i, /House No/i]) {
            expect(screen.queryByText(label)).toBeNull();
        }
        expect(screen.getByText("Google Maps link *")).toBeTruthy();
        const find = screen.getByRole("link", { name: /Find Location on Google Maps/ });
        expect(find.getAttribute("href")).toBe("https://www.google.com/maps");
        expect(find.getAttribute("target")).toBe("_blank");
        expect(find.getAttribute("rel")).toBe("noopener noreferrer");
        expect(businessPhone().dataset.countries).toBe("ET");
    });

    it("needs the link before going on", () => {
        toBusinessStep();
        fireEvent.change(businessPhone(), { target: { value: "+251911000000" } });
        expect(next().disabled).toBe(true);
        typeInto("Google Maps link *", LINK);
        expect(next().disabled).toBe(false);
    });

    it("explains an invalid link and stays on the step", () => {
        toBusinessStep();
        fireEvent.change(businessPhone(), { target: { value: "+251911000000" } });
        typeInto("Google Maps link *", "https://google.com.evil.example/maps/x");
        expect(within(fieldBox("Google Maps link *")).getByText(/Use a Google Maps share link/)).toBeTruthy();
        fireEvent.click(next());
        expect(screen.queryByText("Restaurant short name *")).toBeNull();
    });

    it("sends the country and the trimmed link, and no address fields", async () => {
        toBusinessStep();
        fillEthiopia();
        finish();
        await waitFor(() => expect(register).toHaveBeenCalled());
        const payload = register.mock.calls[0][0];
        expect(payload).toMatchObject({ country: "ET", locationUrl: LINK });
        for (const key of ADDRESS_KEYS) expect(payload).not.toHaveProperty(key);
    });
});

describe("registration: United States", () => {
    it("shows street, city, state and ZIP as required, the link as optional, and a US phone", () => {
        toBusinessStep();
        chooseCountry("US");
        for (const label of ["Street Address *", "City *", "State *", "ZIP Code *", "Google Maps link (optional)"]) {
            expect(screen.getByText(label)).toBeTruthy();
        }
        expect(screen.queryByText(/Region/)).toBeNull();
        expect(screen.queryByText(/Postal Code/)).toBeNull();
        expect(within(screen.getByLabelText("State *")).getAllByRole("option")).toHaveLength(52); // placeholder + 51
        expect(businessPhone().dataset.countries).toBe("US");
    });

    it("needs every address field and a valid ZIP before going on", () => {
        toBusinessStep();
        fillUnitedStates();
        expect(next().disabled).toBe(false);
        typeInto("ZIP Code *", "1011");
        expect(within(fieldBox("ZIP Code *")).getByText(/12345 or 12345-6789/)).toBeTruthy();
        expect(next().disabled).toBe(true);
        typeInto("ZIP Code *", "10118");
        typeInto("City *", " ");
        expect(next().disabled).toBe(true);
    });

    it("sends the country and the address without a link", async () => {
        toBusinessStep();
        fillUnitedStates();
        finish();
        await waitFor(() => expect(register).toHaveBeenCalled());
        const payload = register.mock.calls[0][0];
        expect(payload).toMatchObject({ country: "US", streetAddress: "350 5th Ave", city: "New York", state: "NY", zipcode: "10118" });
        expect(payload.locationUrl).toBeUndefined();
    });

    it("returns to the business step with a server error under ZIP Code", async () => {
        register.mockRejectedValueOnce({ response: { status: 400, data: { message: "Validation failed",
            fieldErrors: [{ field: "zipcode", message: "Enter a ZIP code (server)" }] } } });
        toBusinessStep();
        fillUnitedStates();
        finish();
        expect(await within(await waitFor(() => fieldBox("ZIP Code *"))).findByText("Enter a ZIP code (server)")).toBeTruthy();
    });
});

describe("registration: changing country", () => {
    it("swaps the fields, clears a phone from the other country and sends only the selected country's fields", async () => {
        toBusinessStep();
        fillUnitedStates();
        chooseCountry("ET");
        expect(screen.queryByText("Street Address *")).toBeNull();
        expect(businessPhone().value).toBe(""); // the US number doesn't fit Ethiopia
        expect(next().disabled).toBe(true);
        fillEthiopia();
        chooseCountry("US");
        expect((screen.getByLabelText("State *") as HTMLSelectElement).value).toBe("NY"); // typed values are kept
        chooseCountry("ET");
        fireEvent.change(businessPhone(), { target: { value: "+251911000000" } });
        finish();
        await waitFor(() => expect(register).toHaveBeenCalled());
        const payload = register.mock.calls[0][0];
        expect(payload.country).toBe("ET");
        for (const key of ADDRESS_KEYS) expect(payload).not.toHaveProperty(key);
    });
});
