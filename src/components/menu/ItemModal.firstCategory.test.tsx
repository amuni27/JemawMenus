// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ToastProvider } from "../ui/ToastContext";
import type { Category } from "../../types/menu";

// AGF-S2-34 (defect F1): the item form must never lose a value because a handler wrote back an older copy of the form.
// In the browser the default category (set when the form opens) was overwritten by the first keystroke, so Create
// stayed disabled until the category was chosen again. jsdom re-renders between events, so it cannot recreate that
// timing: these tests guard the expected behaviour, and the E2E journey J2 (e2e/smoke.e2e.ts) is the regression test
// that fails without the fix.

const { default: ItemModal } = await import("./ItemModal.tsx");

afterEach(() => cleanup());

const mains: Category = { id: "c1", menuId: "m1", name: "Mains", isActive: true, sortOrder: 0, createdAt: "", updatedAt: "" };
const drinks: Category = { id: "c2", menuId: "m1", name: "Drinks", isActive: true, sortOrder: 1, createdAt: "", updatedAt: "" };

function renderForm(categories: Category[], open = true) {
    const onCreate = vi.fn().mockResolvedValue({ id: "new-1" });
    const props = { onClose: () => {}, menuId: "m1", currency: "ETB", onCreate, onUpdate: vi.fn(), onConfirmImage: vi.fn() };
    const view = render(<ToastProvider><ItemModal open={open} categories={categories} {...props} /></ToastProvider>);
    const rerender = (cats: Category[], isOpen: boolean) =>
        view.rerender(<ToastProvider><ItemModal open={isOpen} categories={cats} {...props} /></ToastProvider>);
    return { onCreate, rerender };
}

const nameBox = () => screen.getAllByRole("textbox")[0] as HTMLInputElement;
const priceBox = () => within(screen.getByText("Price (ETB)").parentElement as HTMLElement).getByRole("textbox") as HTMLInputElement;
const categorySelect = () => screen.getByRole("combobox", { name: "Category" }) as HTMLSelectElement;
const createButton = () => screen.getByRole("button", { name: "Create" }) as HTMLButtonElement;
function addIngredient(value: string) {
    const input = screen.getByPlaceholderText("Add ingredient");
    fireEvent.change(input, { target: { value } });
    fireEvent.keyDown(input, { key: "Enter" });
}

describe("item form keeps every change (F1)", () => {
    // AC2
    it("keeps name, price, category and description when they change in quick succession", () => {
        renderForm([mains, drinks]);

        act(() => {
            fireEvent.change(nameBox(), { target: { value: "Beef Tibs" } });
            fireEvent.change(priceBox(), { target: { value: "380" } });
            fireEvent.change(categorySelect(), { target: { value: "c2" } });
            fireEvent.change(screen.getByPlaceholderText("Description"), { target: { value: "Spicy" } });
        });

        expect(nameBox().value).toBe("Beef Tibs");
        expect(priceBox().value).toBe("380");
        expect(categorySelect().value).toBe("c2");
        expect((screen.getByPlaceholderText("Description") as HTMLTextAreaElement).value).toBe("Spicy");
    });

    // AC1 (the reported sequence)
    it("enables Create with the menu's first category, added while the form was closed, without re-selecting it", async () => {
        const { onCreate, rerender } = renderForm([], false);
        rerender([mains], false);
        rerender([mains], true);

        act(() => {
            fireEvent.change(nameBox(), { target: { value: "Beef Tibs" } });
            fireEvent.change(priceBox(), { target: { value: "380" } });
        });
        addIngredient("beef");

        expect(createButton().disabled).toBe(false);
        await act(async () => { fireEvent.click(createButton()); });
        expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ name: "Beef Tibs", categoryId: "c1" }));
    });

    // AC3
    it("still saves a different chosen category", async () => {
        const { onCreate } = renderForm([mains, drinks]);
        fireEvent.change(nameBox(), { target: { value: "Tea" } });
        fireEvent.change(priceBox(), { target: { value: "50" } });
        fireEvent.change(categorySelect(), { target: { value: "c2" } });
        addIngredient("tea");

        await act(async () => { fireEvent.click(createButton()); });
        expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ categoryId: "c2" }));
    });
});
