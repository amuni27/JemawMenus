// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "../ui/ToastContext";
import type { Category, MenuItem } from "../../types/menu";

// AGF-S2-23 (checkpoint A): the item form has optional Amharic name and description. New items send them only when
// filled; edits send them only when changed, and an emptied field clears the translation ("").

const { default: ItemModal } = await import("./ItemModal.tsx");

afterEach(() => cleanup());

const category: Category = { id: "c1", menuId: "m1", name: "Mains", isActive: true, sortOrder: 0, createdAt: "", updatedAt: "" };
const saved = {
    id: "i1", menuId: "m1", categoryId: "c1", name: "Doro Wat", price: 420, ingredients: ["chicken"], status: "AVAILABLE",
    createdAt: "", updatedAt: "", allergens: [], tags: [], featured: false, nameAm: "ዶሮ ወጥ", descriptionAm: "የዶሮ ወጥ",
} as unknown as MenuItem;

function renderModal(item?: MenuItem, onUpdate = vi.fn().mockResolvedValue({ id: "i1" })) {
    const onCreate = vi.fn().mockResolvedValue({ id: "new-1" });
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

const nameAm = () => screen.getByLabelText("Name in Amharic (optional)") as HTMLInputElement;
const descriptionAm = () => screen.getByLabelText("Description in Amharic (optional)") as HTMLTextAreaElement;

function fillNewItem() {
    fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: "Shiro" } });
    const priceBox = screen.getByText("Price (ETB)").parentElement as HTMLElement;
    fireEvent.change(within(priceBox).getByRole("textbox"), { target: { value: "8" } });
    const ingredient = screen.getByPlaceholderText("Add ingredient");
    fireEvent.change(ingredient, { target: { value: "chickpea" } });
    fireEvent.keyDown(ingredient, { key: "Enter" });
}

describe("item form: Amharic", () => {
    it("starts empty for a new item and sends a filled translation, trimmed", async () => {
        const { onCreate } = renderModal();
        expect(nameAm().value).toBe("");
        fillNewItem();
        fireEvent.change(nameAm(), { target: { value: " ሽሮ " } });
        fireEvent.change(descriptionAm(), { target: { value: "የሽምብራ ወጥ" } });
        fireEvent.click(screen.getByRole("button", { name: "Create" }));
        await waitFor(() => expect(onCreate).toHaveBeenCalled());
        expect(onCreate.mock.calls[0][0]).toMatchObject({ nameAm: "ሽሮ", descriptionAm: "የሽምብራ ወጥ" });
    });

    it("doesn't send empty translations for a new item", async () => {
        const { onCreate } = renderModal();
        fillNewItem();
        fireEvent.click(screen.getByRole("button", { name: "Create" }));
        await waitFor(() => expect(onCreate).toHaveBeenCalled());
        expect(onCreate.mock.calls[0][0]).not.toHaveProperty("nameAm");
        expect(onCreate.mock.calls[0][0]).not.toHaveProperty("descriptionAm");
    });

    it("shows the saved translation and sends nothing when it is unchanged", async () => {
        const { onUpdate } = renderModal(saved);
        expect(nameAm().value).toBe("ዶሮ ወጥ");
        expect(descriptionAm().value).toBe("የዶሮ ወጥ");
        fireEvent.click(screen.getByRole("button", { name: "Save" }));
        await waitFor(() => expect(onUpdate).toHaveBeenCalled());
        expect(onUpdate.mock.calls[0][1]).not.toHaveProperty("nameAm");
        expect(onUpdate.mock.calls[0][1]).not.toHaveProperty("descriptionAm");
    });

    it("sends a changed translation and clears an emptied one", async () => {
        const { onUpdate } = renderModal(saved);
        fireEvent.change(nameAm(), { target: { value: "ዶሮ ወጥ በእንጀራ" } });
        fireEvent.change(descriptionAm(), { target: { value: "  " } });
        fireEvent.click(screen.getByRole("button", { name: "Save" }));
        await waitFor(() => expect(onUpdate).toHaveBeenCalled());
        expect(onUpdate.mock.calls[0][1]).toMatchObject({ nameAm: "ዶሮ ወጥ በእንጀራ", descriptionAm: "" });
    });

    it("shows a server error under the Amharic description", async () => {
        const onUpdate = vi.fn().mockRejectedValue({ response: { status: 400, data: { message: "Validation failed",
            fieldErrors: [{ field: "descriptionAm", message: "size must be between 0 and 255" }] } } });
        renderModal(saved, onUpdate);
        fireEvent.change(descriptionAm(), { target: { value: "ሀ".repeat(256) } });
        fireEvent.click(screen.getByRole("button", { name: "Save" }));
        expect(await screen.findByText("size must be between 0 and 255")).toBeTruthy();
    });
});
