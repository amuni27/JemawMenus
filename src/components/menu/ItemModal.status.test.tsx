// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ToastProvider } from "../ui/ToastContext";
import ItemModal from "./ItemModal";
import type { Category, MenuItem } from "../../types/menu";

// AGF-S1-12 (owner side): the edit modal offers all three statuses with guest-impact help text.

afterEach(cleanup);

const category: Category = { id: "c1", menuId: "m1", name: "Mains", isActive: true, sortOrder: 0, createdAt: "", updatedAt: "" };
const existing: MenuItem = {
    id: "i1", menuId: "m1", categoryId: "c1", name: "Tibs", price: 420,
    ingredients: ["beef"], status: "AVAILABLE", createdAt: "", updatedAt: "",
};

function renderModal() {
    const onUpdate = vi.fn().mockResolvedValue({ ...existing, status: "OUT_OF_STOCK" });
    render(
        <ToastProvider>
            <ItemModal open onClose={() => {}} menuId="m1" item={existing} categories={[category]}
                       onCreate={vi.fn()} onUpdate={onUpdate} onConfirmImage={vi.fn()} />
        </ToastProvider>
    );
    return onUpdate;
}

const statusSelect = () => screen.getByRole("option", { name: /Out of stock/i }).closest("select") as HTMLSelectElement;

describe("ItemModal status options", () => {
    it("offers Available, Out of stock (Sold Out) and Unavailable (hidden)", () => {
        renderModal();
        const labels = Array.from(statusSelect().options).map((o) => o.textContent);
        expect(labels).toEqual([
            "Available",
            "Out of stock — shown to guests as Sold Out",
            "Unavailable — hidden from guests",
        ]);
        expect(Array.from(statusSelect().options).map((o) => o.value)).toEqual(["AVAILABLE", "OUT_OF_STOCK", "UNAVAILABLE"]);
    });

    it("saves OUT_OF_STOCK when selected", async () => {
        const onUpdate = renderModal();
        fireEvent.change(statusSelect(), { target: { value: "OUT_OF_STOCK" } });
        expect(screen.getByText(/Guests see this item marked Sold Out/i)).toBeTruthy();

        fireEvent.click(screen.getByRole("button", { name: "Save" }));

        await waitFor(() => expect(onUpdate).toHaveBeenCalledWith("i1", expect.objectContaining({ status: "OUT_OF_STOCK" })));
    });
});
