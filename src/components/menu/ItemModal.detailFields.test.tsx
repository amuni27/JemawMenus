// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "../ui/ToastContext";
import type { Category, MenuItem } from "../../types/menu";

// AGF-S2-06: owners set allergens, tags, spice level, featured and prep time; values guests see on item detail.

const { default: ItemModal } = await import("./ItemModal.tsx");

afterEach(() => cleanup());

const category: Category = { id: "c1", menuId: "m1", name: "Mains", isActive: true, sortOrder: 0, createdAt: "", updatedAt: "" };
const legacy = {
    id: "i1", menuId: "m1", categoryId: "c1", name: "Tibs", price: 420, ingredients: ["beef"], status: "AVAILABLE",
    createdAt: "", updatedAt: "",
    // as the owner API returns them: the flag is called "featured" in responses
    allergens: ["dairy"], tags: ["chef's pick"], spiceLevel: "HOT", featured: true, prepTimeMinutes: 20,
} as unknown as MenuItem;

function renderModal(item?: MenuItem) {
    const onCreate = vi.fn().mockResolvedValue({ id: "new-1" });
    const onUpdate = vi.fn().mockResolvedValue({ id: item?.id });
    render(
        <ToastProvider>
            <MemoryRouter>
                <ItemModal open onClose={() => {}} menuId="m1" item={item} categories={[category]} currency="ETB"
                           onCreate={onCreate} onUpdate={onUpdate} onConfirmImage={vi.fn()} />
            </MemoryRouter>
        </ToastProvider>
    );
    return { onCreate, onUpdate };
}

const allergensBox = () => screen.getByRole("group", { name: "Allergens" });
const tagsBox = () => screen.getByRole("group", { name: "Tags" });
const pills = (box: HTMLElement) => within(box).queryAllByRole("button", { name: /^Remove / }).map((b) => b.getAttribute("aria-label")!.replace("Remove ", ""));
const prep = () => screen.getByLabelText("Prep time (minutes)") as HTMLInputElement;
const spice = () => screen.getByLabelText("Spice level") as HTMLSelectElement;
const featured = () => screen.getByRole("checkbox", { name: /featured/i }) as HTMLInputElement;

function fillRequired() {
    fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: "Beef Tibs" } });
    const priceBox = screen.getByText("Price (ETB)").parentElement as HTMLElement;
    fireEvent.change(within(priceBox).getByRole("textbox"), { target: { value: "380" } });
    const ingredient = screen.getByPlaceholderText("Add ingredient");
    fireEvent.change(ingredient, { target: { value: "beef" } });
    fireEvent.keyDown(ingredient, { key: "Enter" });
}

function addPill(box: HTMLElement, value: string) {
    const input = within(box).getByRole("textbox");
    fireEvent.change(input, { target: { value } });
    fireEvent.keyDown(input, { key: "Enter" });
}

describe("item form: detail fields", () => {
    it("sends allergens, tags, spice level, featured and prep time when creating", async () => {
        const { onCreate } = renderModal();
        fillRequired();

        fireEvent.click(within(allergensBox()).getByRole("button", { name: "Add gluten" })); // suggestion
        addPill(allergensBox(), "Mustard");
        addPill(allergensBox(), "GLUTEN"); // duplicate, ignored (case-insensitive)
        addPill(tagsBox(), "fasting");
        fireEvent.change(spice(), { target: { value: "EXTRA_HOT" } });
        fireEvent.click(featured());
        fireEvent.change(prep(), { target: { value: "15" } });

        expect(pills(allergensBox())).toEqual(["gluten", "Mustard"]);
        fireEvent.click(screen.getByRole("button", { name: "Create" }));

        await waitFor(() => expect(onCreate).toHaveBeenCalled());
        expect(onCreate.mock.calls[0][0]).toMatchObject({
            allergens: ["gluten", "Mustard"], tags: ["fasting"], spiceLevel: "EXTRA_HOT", isFeatured: true, prepTimeMinutes: 15,
        });
    });

    it("offers the nine common allergens and spice levels None to Extra hot", () => {
        renderModal();
        for (const a of ["gluten", "dairy", "eggs", "nuts", "peanuts", "soy", "fish", "shellfish", "sesame"]) {
            expect(within(allergensBox()).getByRole("button", { name: `Add ${a}` })).toBeTruthy();
        }
        expect([...spice().options].map((o) => o.textContent)).toEqual(["Not set", "None", "Mild", "Medium", "Hot", "Extra hot"]);
    });

    it("rejects a negative or fractional prep time and saves nothing (AC2)", async () => {
        const { onCreate } = renderModal();
        fillRequired();

        fireEvent.change(prep(), { target: { value: "-5" } });
        expect(screen.getByText("Prep time must be 0 or more minutes")).toBeTruthy();
        const create = screen.getByRole("button", { name: "Create" }) as HTMLButtonElement;
        expect(create.disabled).toBe(true);
        fireEvent.click(create);

        fireEvent.change(prep(), { target: { value: "2.5" } });
        expect(screen.getByText("Use whole minutes")).toBeTruthy();
        expect((screen.getByRole("button", { name: "Create" }) as HTMLButtonElement).disabled).toBe(true);

        await Promise.resolve();
        expect(onCreate).not.toHaveBeenCalled();
    });

    it("shows the backend prep time error under the field (S1-10 / S2-11)", async () => {
        const { onCreate } = renderModal();
        onCreate.mockRejectedValue({ response: { status: 400, data: { message: "Validation failed",
            fieldErrors: [{ field: "prepTimeMinutes", message: "must be greater than or equal to 0" }] } } });
        fillRequired();
        fireEvent.change(prep(), { target: { value: "10" } });
        fireEvent.click(screen.getByRole("button", { name: "Create" }));

        expect(await screen.findByText("must be greater than or equal to 0")).toBeTruthy();
        expect(screen.queryByText("Validation failed")).toBeNull();
    });

    it("loads an existing item's values unchanged and does not resend them (AC3)", async () => {
        const { onUpdate } = renderModal(legacy);

        expect(pills(allergensBox())).toEqual(["dairy"]);
        expect(pills(tagsBox())).toEqual(["chef's pick"]);
        expect(spice().value).toBe("HOT");
        expect(featured().checked).toBe(true);
        expect(prep().value).toBe("20");

        fireEvent.click(screen.getByRole("button", { name: "Save" }));
        await waitFor(() => expect(onUpdate).toHaveBeenCalled());
        const payload = onUpdate.mock.calls[0][1];
        for (const key of ["allergens", "tags", "spiceLevel", "isFeatured", "prepTimeMinutes"]) {
            expect(payload).not.toHaveProperty(key);
        }
    });

    it("sends only the detail fields the owner changed", async () => {
        const { onUpdate } = renderModal(legacy);
        fireEvent.click(within(allergensBox()).getByRole("button", { name: "Remove dairy" }));
        addPill(allergensBox(), "eggs");
        fireEvent.click(within(tagsBox()).getByRole("button", { name: "Remove chef's pick" }));
        fireEvent.click(featured());

        fireEvent.click(screen.getByRole("button", { name: "Save" }));
        await waitFor(() => expect(onUpdate).toHaveBeenCalled());
        const payload = onUpdate.mock.calls[0][1];
        expect(payload).toMatchObject({ allergens: ["eggs"], tags: [], isFeatured: false });
        expect(payload).not.toHaveProperty("spiceLevel");
        expect(payload).not.toHaveProperty("prepTimeMinutes");
    });

    it("handles missing and legacy values safely", () => {
        renderModal({ ...legacy, allergens: "nuts, dairy", tags: null, spiceLevel: "VOLCANIC", featured: undefined,
            prepTimeMinutes: null } as unknown as MenuItem);

        expect(pills(allergensBox())).toEqual(["nuts", "dairy"]);
        expect(pills(tagsBox())).toEqual([]);
        expect(spice().value).toBe("VOLCANIC"); // an unknown stored level is kept as an option
        expect(featured().checked).toBe(false);
        expect(prep().value).toBe("");
    });

    // AGF-S2-30 replaced the old "a saved prep time can't be removed yet" note: see ItemModal.clearFields.test.tsx
});
