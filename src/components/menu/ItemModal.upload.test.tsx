// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ToastProvider } from "../ui/ToastContext";
import type { Category, MenuItem } from "../../types/menu";

// AGF-S1-17: the item image upload sends the file's content type to presign and refuses unsupported files.

const uploadToR2 = vi.fn();
vi.mock("../../utils/r2Service", () => ({ uploadToR2 }));
vi.mock("../../utils/r2Service.ts", () => ({ uploadToR2 }));

const { default: ItemModal } = await import("./ItemModal.tsx");

beforeAll(() => {
    URL.createObjectURL = () => "blob:preview";
});
afterEach(() => cleanup());

const category: Category = { id: "c1", menuId: "m1", name: "Mains", isActive: true, sortOrder: 0, createdAt: "", updatedAt: "" };
const existing: MenuItem = {
    id: "i1", menuId: "m1", categoryId: "c1", name: "Tibs", price: 420,
    ingredients: ["beef"], status: "AVAILABLE", createdAt: "", updatedAt: "",
};

function renderModal() {
    const onPresignImage = vi.fn().mockResolvedValue({
        upload: { uploadUrl: "https://r2.test.invalid/put", objectKey: "agafari/menu-items/i1/main.png", expiresInSeconds: 300 },
    });
    const onConfirmImage = vi.fn().mockResolvedValue({ ...existing, imageUrl: "https://images.test.invalid/agafari/menu-items/i1/main.png" });
    render(
        <ToastProvider>
            <ItemModal open onClose={() => {}} menuId="m1" item={existing} categories={[category]}
                       onCreate={vi.fn()} onUpdate={vi.fn().mockResolvedValue(existing)}
                       onPresignImage={onPresignImage} onConfirmImage={onConfirmImage} />
        </ToastProvider>
    );
    return { onPresignImage, onConfirmImage };
}

const fileInput = () => document.querySelector("input[type=file]") as HTMLInputElement;
const pick = (file: File) => fireEvent.change(fileInput(), { target: { files: [file] } });

describe("ItemModal image upload", () => {
    it("only offers JPEG, PNG and WebP in the file picker", () => {
        renderModal();
        expect(fileInput().accept).toBe("image/jpeg,image/png,image/webp");
    });

    it("refuses HEIC and unsupported files with a clear message", async () => {
        const { onPresignImage } = renderModal();
        pick(new File(["x"], "photo.heic", { type: "image/heic" }));
        expect(await screen.findByText("HEIC photos aren't supported yet. Please upload a JPEG, PNG or WebP image.")).toBeTruthy();
        pick(new File(["x"], "menu.gif", { type: "image/gif" }));
        expect(await screen.findByText("Unsupported image type. Upload a JPEG, PNG or WebP image.")).toBeTruthy();
        expect(onPresignImage).not.toHaveBeenCalled();
    });

    it("presigns with the file's content type, uploads and confirms", async () => {
        const { onPresignImage, onConfirmImage } = renderModal();
        const file = new File(["png-bytes"], "dish.png", { type: "image/png" });
        pick(file);
        fireEvent.click(screen.getByRole("button", { name: "Save" }));

        await waitFor(() => expect(onConfirmImage).toHaveBeenCalledWith("i1", "agafari/menu-items/i1/main.png"));
        expect(onPresignImage).toHaveBeenCalledWith("i1", "image/png");
        expect(uploadToR2).toHaveBeenCalledWith("https://r2.test.invalid/put", file);
    });
});
