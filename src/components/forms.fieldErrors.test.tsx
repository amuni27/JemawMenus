// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "./ui/ToastContext";
import type { Category, MenuItem } from "../types/menu";

// AGF-S2-11: backend field errors appear under the matching field in the menu, item, category,
// business profile and registration forms; server messages are kept when there are no field errors.

const listMenuTypes = vi.fn().mockResolvedValue({ data: [{ id: "t1", name: "Lunch" }] });
vi.mock("../api/menuApi", () => ({ default: { listMenuTypes } }));
const updateBusiness = vi.fn();
vi.mock("../api/profileApi", () => ({ profileApi: { updateBusiness } }));
const register = vi.fn();
vi.mock("../app/context/AuthContext", () => ({ useAuth: () => ({ register, loading: false }) }));
vi.mock("react-phone-number-input", () => ({
    default: (props: { placeholder?: string; value?: string; onChange: (v: string) => void }) => (
        <input aria-label={props.placeholder} value={props.value ?? ""} onChange={(e) => props.onChange(e.target.value)} />
    ),
    isValidPhoneNumber: () => true,
}));

const { default: MenuWizard } = await import("../pages/menus/MenuWizard.tsx");
const { default: ItemModal } = await import("./menu/ItemModal.tsx");
const { default: CategoryModal } = await import("./menu/CategoryModal.tsx");
const { default: BusinessProfileModal } = await import("./account/BusinessProfileModal.tsx");
const { default: RegisterWizard } = await import("../pages/public/RegisterWizard.tsx");

afterEach(() => cleanup());

const fieldErrors = (errors: { field: string; message: string }[]) => ({
    response: { status: 400, data: { status: 400, error: "Bad Request", message: "Validation failed", fieldErrors: errors } },
});
const fieldBox = (label: string) => screen.getByText(label).parentElement as HTMLElement;
const wrap = (ui: React.ReactNode) => render(<ToastProvider><MemoryRouter>{ui}</MemoryRouter></ToastProvider>);

describe("menu form", () => {
    it("shows the backend name error under Menu Name and clears it when the name changes", async () => {
        const onSave = vi.fn().mockRejectedValue(fieldErrors([{ field: "name", message: "size must be between 1 and 255" }]));
        wrap(<MenuWizard onSave={onSave} />);
        await screen.findByRole("option", { name: "Lunch" });
        const name = screen.getAllByRole("textbox")[0];
        fireEvent.change(name, { target: { value: "X".repeat(300) } });
        fireEvent.change(screen.getByLabelText("Menu Type"), { target: { value: "t1" } });
        fireEvent.click(screen.getByRole("button", { name: "Save Menu" }));

        expect(await within(fieldBox("Menu Name")).findByText("size must be between 1 and 255")).toBeTruthy();
        expect(screen.queryByText("Validation failed")).toBeNull();

        fireEvent.change(name, { target: { value: "Lunch" } });
        expect(within(fieldBox("Menu Name")).queryByText("size must be between 1 and 255")).toBeNull();
    });

    it("keeps the server message when there are no field errors", async () => {
        const onSave = vi.fn().mockRejectedValue({ response: { status: 400, data: { message: "Invalid menu type" } } });
        wrap(<MenuWizard onSave={onSave} />);
        await screen.findByRole("option", { name: "Lunch" });
        fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: "Lunch" } });
        fireEvent.change(screen.getByLabelText("Menu Type"), { target: { value: "t1" } });
        fireEvent.click(screen.getByRole("button", { name: "Save Menu" }));
        expect((await screen.findByRole("alert")).textContent).toBe("Invalid menu type");
    });
});

const category: Category = { id: "c1", menuId: "m1", name: "Mains", isActive: true, sortOrder: 0, createdAt: "", updatedAt: "" };
const item: MenuItem = { id: "i1", menuId: "m1", categoryId: "c1", name: "Tibs", price: 420, ingredients: ["beef"], status: "AVAILABLE", createdAt: "", updatedAt: "" };

describe("item form", () => {
    it("shows backend errors under Price and Calories, not as a 'Validation failed' toast", async () => {
        const onUpdate = vi.fn().mockRejectedValue(fieldErrors([
            { field: "price", message: "must be greater than or equal to 0.00" },
            { field: "calories", message: "must be greater than or equal to 0" },
        ]));
        wrap(<ItemModal open onClose={() => {}} menuId="m1" item={item} categories={[category]} currency="ETB"
                        onCreate={vi.fn()} onUpdate={onUpdate} onConfirmImage={vi.fn()} />);
        fireEvent.click(screen.getByRole("button", { name: "Save" }));

        expect(await within(fieldBox("Price (ETB)")).findByText("must be greater than or equal to 0.00")).toBeTruthy();
        expect(within(fieldBox("Calories")).getByText("must be greater than or equal to 0")).toBeTruthy();
        expect(screen.queryByText("Validation failed")).toBeNull();
    });
});

describe("category form", () => {
    it("shows the backend name error under Name; other errors keep the server message", async () => {
        const onCreate = vi.fn().mockRejectedValueOnce(fieldErrors([{ field: "name", message: "size must be between 0 and 255" }]))
            .mockRejectedValueOnce({ response: { status: 400, data: { message: "Category has items; delete items first" } } });
        wrap(<CategoryModal open onClose={() => {}} menuId="m1" onCreate={onCreate} onUpdate={vi.fn()} />);
        fireEvent.change(screen.getByRole("textbox"), { target: { value: "Desserts" } });
        fireEvent.click(screen.getByRole("button", { name: "Create" }));
        expect(await within(fieldBox("Name")).findByText("size must be between 0 and 255")).toBeTruthy();

        fireEvent.change(screen.getByRole("textbox"), { target: { value: "Drinks" } });
        expect(within(fieldBox("Name")).queryByText("size must be between 0 and 255")).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "Create" }));
        expect(await screen.findByText("Category has items; delete items first")).toBeTruthy();
    });
});

describe("business profile form", () => {
    it("shows field errors under the field and non-field errors as the server message", async () => {
        updateBusiness.mockRejectedValueOnce(fieldErrors([{ field: "city", message: "must not be blank" }]))
            .mockRejectedValueOnce({ response: { status: 400, data: { message: "Unsupported currency. Use ETB or USD." } } });
        wrap(<BusinessProfileModal open onClose={() => {}} onSaved={() => {}}
                                   business={{ id: "b1", name: "Cafe", country: "US", businessPhone: "+12125550100", streetAddress: "350 5th Ave", city: "New York", state: "NY", zipcode: "10118", timeZone: "America/New_York", currency: "ETB", createdAt: new Date(), updatedAt: new Date() }} />);
        fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
        expect(await within(fieldBox("City")).findByText("must not be blank")).toBeTruthy();

        fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
        expect(await screen.findByText("Unsupported currency. Use ETB or USD.")).toBeTruthy();
    });
});

describe("registration", () => {
    async function fillAndSubmit() {
        wrap(<RegisterWizard />);
        const typeInto = (label: string, value: string) =>
            fireEvent.change(within(fieldBox(label)).getByRole("textbox", { hidden: true }) ?? screen.getByLabelText(label), { target: { value } });
        typeInto("Full Name *", "Demo Owner");
        typeInto("Email *", "owner@example.com");
        const pw = document.querySelectorAll("input[type=password]");
        fireEvent.change(pw[0], { target: { value: "Str0ng!Pass" } });
        fireEvent.change(pw[1], { target: { value: "Str0ng!Pass" } });
        fireEvent.click(screen.getByRole("button", { name: /next/i }));

        typeInto("Business Name *", "Cafe");
        fireEvent.change(screen.getByLabelText("Enter business phone number"), { target: { value: "+251911000000" } });
        typeInto("Google Maps link *", "https://maps.app.goo.gl/AbC123xyz"); // CR1: Ethiopia needs only the link
        fireEvent.click(screen.getByRole("button", { name: /next/i }));

        typeInto("Restaurant short name *", "abol-cafe");
        fireEvent.click(screen.getByRole("button", { name: /complete|finish|create|register/i }));
    }

    it("returns to the step with the failing field and shows the message under it", async () => {
        register.mockRejectedValue(fieldErrors([{ field: "password", message: "Password must be 8-72 characters and include an uppercase letter, a lowercase letter, a number and a symbol" }]));
        await fillAndSubmit();

        await screen.findByText("Password *"); // the wizard went back to the Personal step
        expect(within(fieldBox("Password *")).getByText(/Password must be 8-72 characters/)).toBeTruthy();
        expect(screen.queryByText("Validation failed")).toBeNull();
    });

    it("shows a subdomain error on the subdomain step and keeps duplicate-email messages", async () => {
        register.mockRejectedValueOnce(fieldErrors([{ field: "customSubdomain", message: "Invalid subdomain" }]));
        await fillAndSubmit();
        expect(await within(fieldBox("Restaurant short name *")).findByText("Invalid subdomain")).toBeTruthy();
        // AGF-S2-29: the field no longer promises a working sub-domain
        expect(screen.getByText("Reserved for your future Agafari web address. Guests use your menu link and QR code.")).toBeTruthy();
        expect(screen.queryByText(/Choose your subdomain/)).toBeNull();

        cleanup();
        register.mockRejectedValueOnce({ response: { status: 400, data: { message: "This email is already registered." } } });
        await fillAndSubmit();
        expect((await screen.findAllByText("This email is already registered.")).length).toBeGreaterThan(0);
    });
});
