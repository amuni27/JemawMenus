// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ToastProvider } from "../ui/ToastContext";
import type { Category, MenuItem } from "../../types/menu";

// AGF-S2-16: "Remove image" in the item form marks the photo for removal (Undo / Cancel discard it); Save stores the
// fields first, then removes the photo. A new file is a replace, not a removal. A failed removal after a successful
// save is reported without a false success.

const uploadToR2 = vi.fn();
vi.mock("../../utils/r2Service", () => ({ uploadToR2 }));
vi.mock("../../utils/r2Service.ts", () => ({ uploadToR2 }));

const { default: ItemModal } = await import("./ItemModal.tsx");

beforeAll(() => {
    URL.createObjectURL = () => "blob:preview";
    URL.revokeObjectURL = () => {};
});
afterEach(() => cleanup());

const category: Category = { id: "c1", menuId: "m1", name: "Mains", isActive: true, sortOrder: 0, createdAt: "", updatedAt: "" };
const withPhoto: MenuItem = {
    id: "i1", menuId: "m1", categoryId: "c1", name: "Tibs", price: 420, ingredients: ["beef"], status: "AVAILABLE",
    imageUrl: "https://images.test.invalid/agafari/menu-items/i1/main.jpg", createdAt: "", updatedAt: "",
};

function renderModal(item: MenuItem = withPhoto, removeResult: Promise<unknown> = Promise.resolve({ ...withPhoto, imageUrl: null })) {
    const calls: string[] = [];
    const onUpdate = vi.fn().mockImplementation(async () => { calls.push("update"); return item; });
    const onRemoveImage = vi.fn().mockImplementation(() => { calls.push("remove"); return removeResult; });
    const onPresignImage = vi.fn().mockResolvedValue({
        upload: { uploadUrl: "https://r2.test.invalid/put", objectKey: "agafari/menu-items/i1/main.png", expiresInSeconds: 300 },
    });
    const onConfirmImage = vi.fn().mockResolvedValue({ ...item, imageUrl: "https://images.test.invalid/agafari/menu-items/i1/main.png" });
    const onClose = vi.fn();
    render(
        <ToastProvider>
            <ItemModal open onClose={onClose} menuId="m1" item={item} categories={[category]}
                       onCreate={vi.fn()} onUpdate={onUpdate} onRemoveImage={onRemoveImage}
                       onPresignImage={onPresignImage} onConfirmImage={onConfirmImage} />
        </ToastProvider>
    );
    return { calls, onUpdate, onRemoveImage, onConfirmImage, onClose };
}

const removeButton = () => screen.getByRole("button", { name: "Remove image" });
const preview = () => screen.queryByAltText("preview");
const save = () => fireEvent.click(screen.getByRole("button", { name: "Save" }));

describe("ItemModal: remove image", () => {
    it("marks the photo for removal, hides the preview, announces it and focuses Undo", () => {
        renderModal();
        expect(preview()).toBeTruthy();

        fireEvent.click(removeButton());

        expect(preview()).toBeNull();
        const note = screen.getByText("Image will be removed when you save.");
        expect(note.closest("[aria-live=polite]")).toBeTruthy();
        expect(document.activeElement).toBe(screen.getByRole("button", { name: "Undo" }));
    });

    it("Undo keeps the photo and saving then makes no removal", async () => {
        const { onUpdate, onRemoveImage } = renderModal();

        fireEvent.click(removeButton());
        fireEvent.click(screen.getByRole("button", { name: "Undo" }));
        expect(preview()).toBeTruthy();
        save();

        await waitFor(() => expect(onUpdate).toHaveBeenCalled());
        expect(onRemoveImage).not.toHaveBeenCalled();
    });

    it("Save stores the fields first, then removes the photo, and closes", async () => {
        const { calls, onRemoveImage, onClose } = renderModal();

        fireEvent.click(removeButton());
        save();

        await waitFor(() => expect(onClose).toHaveBeenCalled());
        expect(onRemoveImage).toHaveBeenCalledWith("i1");
        expect(calls).toEqual(["update", "remove"]);
    });

    it("Cancel discards the mark without any request", () => {
        const { onUpdate, onRemoveImage, onClose } = renderModal();

        fireEvent.click(removeButton());
        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

        expect(onClose).toHaveBeenCalled();
        expect(onUpdate).not.toHaveBeenCalled();
        expect(onRemoveImage).not.toHaveBeenCalled();
    });

    it("choosing a new file replaces the photo instead of removing it", async () => {
        const { onRemoveImage, onConfirmImage } = renderModal();

        fireEvent.click(removeButton());
        fireEvent.change(document.querySelector("input[type=file]") as HTMLInputElement,
            { target: { files: [new File(["png"], "dish.png", { type: "image/png" })] } });
        expect(screen.queryByText("Image will be removed when you save.")).toBeNull();
        save();

        await waitFor(() => expect(onConfirmImage).toHaveBeenCalledWith("i1", "agafari/menu-items/i1/main.png"));
        expect(onRemoveImage).not.toHaveBeenCalled();
    });

    it("reports a failed removal after a successful save and stays open with the mark kept", async () => {
        const { onUpdate, onClose } = renderModal(withPhoto, Promise.reject({ response: { status: 500, data: { message: "boom" } } }));

        fireEvent.click(removeButton());
        save();

        expect(await screen.findByText("Your changes were saved, but the image couldn't be removed. Try again.")).toBeTruthy();
        expect(onUpdate).toHaveBeenCalled();
        expect(onClose).not.toHaveBeenCalled();
        expect(screen.getByText("Image will be removed when you save.")).toBeTruthy();
        expect(screen.queryByText("Item updated")).toBeNull();
    });

    it("offers no Remove button for an item without a photo", () => {
        renderModal({ ...withPhoto, imageUrl: null });
        expect(screen.queryByRole("button", { name: "Remove image" })).toBeNull();
    });
});
