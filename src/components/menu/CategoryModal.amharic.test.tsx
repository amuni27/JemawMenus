// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ToastProvider } from "../ui/ToastContext";
import type { Category } from "../../types/menu";

// AGF-S2-23 (checkpoint A): categories have an optional Amharic name. Create sends it when filled; rename sends it
// when changed ("" clears).

const { default: CategoryModal } = await import("./CategoryModal.tsx");

afterEach(() => cleanup());

const mains = { id: "c1", menuId: "m1", name: "Mains", nameAm: "ዋና ምግቦች", sortOrder: 0, createdAt: "", updatedAt: "" } as Category;

function renderModal(category?: Category) {
    const onCreate = vi.fn().mockResolvedValue({ id: "c2" });
    const onUpdate = vi.fn().mockResolvedValue({ id: "c1" });
    render(<ToastProvider><CategoryModal open onClose={() => {}} menuId="m1" category={category} onCreate={onCreate} onUpdate={onUpdate} /></ToastProvider>);
    return { onCreate, onUpdate };
}

const nameAm = () => screen.getByLabelText("Name in Amharic (optional)") as HTMLInputElement;

describe("category form: Amharic", () => {
    it("creates a category with its Amharic name", async () => {
        const { onCreate } = renderModal();
        fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: "Drinks" } });
        fireEvent.change(nameAm(), { target: { value: " መጠጦች " } });
        fireEvent.click(screen.getByRole("button", { name: "Create" }));
        await waitFor(() => expect(onCreate).toHaveBeenCalledWith("Drinks", "መጠጦች"));
    });

    it("creates without a translation when it is empty", async () => {
        const { onCreate } = renderModal();
        fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: "Drinks" } });
        fireEvent.click(screen.getByRole("button", { name: "Create" }));
        await waitFor(() => expect(onCreate).toHaveBeenCalledWith("Drinks", undefined));
    });

    it("keeps an unchanged translation out of a rename and clears an emptied one", async () => {
        const { onUpdate } = renderModal(mains);
        expect(nameAm().value).toBe("ዋና ምግቦች");
        fireEvent.click(screen.getByRole("button", { name: "Save" }));
        await waitFor(() => expect(onUpdate).toHaveBeenCalledWith("c1", "Mains", undefined));

        cleanup();
        const second = renderModal(mains);
        fireEvent.change(nameAm(), { target: { value: "" } });
        fireEvent.click(screen.getByRole("button", { name: "Save" }));
        await waitFor(() => expect(second.onUpdate).toHaveBeenCalledWith("c1", "Mains", ""));
    });
});
