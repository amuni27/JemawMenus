// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "../ui/ToastContext";
import type { Category, MenuItem } from "../../types/menu";

// AGF-S2-30: owners can clear a saved prep time or spice level. The form tells the API apart:
// unchanged (field not sent), a new value (the value), intentionally cleared (clearPrepTime / clearSpiceLevel).

const { default: ItemModal } = await import("./ItemModal.tsx");

afterEach(() => cleanup());

const category: Category = { id: "c1", menuId: "m1", name: "Mains", isActive: true, sortOrder: 0, createdAt: "", updatedAt: "" };
const saved = {
    id: "i1", menuId: "m1", categoryId: "c1", name: "Tibs", price: 420, ingredients: ["beef"], status: "AVAILABLE",
    createdAt: "", updatedAt: "", allergens: [], tags: [], spiceLevel: "HOT", featured: false, prepTimeMinutes: 20,
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

const prep = () => screen.getByLabelText("Prep time (minutes)") as HTMLInputElement;
const spice = () => screen.getByLabelText("Spice level") as HTMLSelectElement;
const save = () => fireEvent.click(screen.getByRole("button", { name: "Save" }));
const sentUpdate = async (onUpdate: ReturnType<typeof vi.fn>) => {
    await waitFor(() => expect(onUpdate).toHaveBeenCalled());
    return onUpdate.mock.calls[0][1] as Record<string, unknown>;
};

describe("item form: clearing prep time and spice level", () => {
    it("clears a saved prep time explicitly and keeps the spice level untouched", async () => {
        const { onUpdate } = renderModal(saved);
        fireEvent.change(prep(), { target: { value: "" } });
        expect(screen.queryByText(/can't be removed/i)).toBeNull();
        save();
        const payload = await sentUpdate(onUpdate);
        expect(payload.clearPrepTime).toBe(true);
        expect(payload).not.toHaveProperty("prepTimeMinutes");
        expect(payload).not.toHaveProperty("spiceLevel");
        expect(payload).not.toHaveProperty("clearSpiceLevel");
    });

    it("clears a saved spice level with 'Not set' and keeps the prep time untouched", async () => {
        const { onUpdate } = renderModal(saved);
        const notSet = [...spice().options].find((o) => o.textContent === "Not set") as HTMLOptionElement;
        expect(notSet.disabled).toBe(false);
        fireEvent.change(spice(), { target: { value: "" } });
        save();
        const payload = await sentUpdate(onUpdate);
        expect(payload.clearSpiceLevel).toBe(true);
        expect(payload).not.toHaveProperty("spiceLevel");
        expect(payload).not.toHaveProperty("prepTimeMinutes");
        expect(payload).not.toHaveProperty("clearPrepTime");
    });

    it("sends neither the fields nor clear flags when only the name changes", async () => {
        const { onUpdate } = renderModal(saved);
        fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: "Beef Tibs" } });
        save();
        const payload = await sentUpdate(onUpdate);
        expect(payload.name).toBe("Beef Tibs");
        for (const key of ["prepTimeMinutes", "spiceLevel", "clearPrepTime", "clearSpiceLevel"]) expect(payload).not.toHaveProperty(key);
    });

    it("sends new values for both together, without clear flags", async () => {
        const { onUpdate } = renderModal(saved);
        fireEvent.change(prep(), { target: { value: "35" } });
        fireEvent.change(spice(), { target: { value: "MILD" } });
        save();
        const payload = await sentUpdate(onUpdate);
        expect(payload).toMatchObject({ prepTimeMinutes: 35, spiceLevel: "MILD" });
        expect(payload).not.toHaveProperty("clearPrepTime");
        expect(payload).not.toHaveProperty("clearSpiceLevel");
    });

    it("clears both together", async () => {
        const { onUpdate } = renderModal(saved);
        fireEvent.change(prep(), { target: { value: "" } });
        fireEvent.change(spice(), { target: { value: "" } });
        save();
        const payload = await sentUpdate(onUpdate);
        expect(payload).toMatchObject({ clearPrepTime: true, clearSpiceLevel: true });
        expect(payload).not.toHaveProperty("prepTimeMinutes");
        expect(payload).not.toHaveProperty("spiceLevel");
    });

    it("loads an item whose values were cleared as empty and resends nothing", async () => {
        const { onUpdate } = renderModal({ ...saved, prepTimeMinutes: null, spiceLevel: null } as unknown as MenuItem);
        expect(prep().value).toBe("");
        expect(spice().value).toBe("");
        save();
        const payload = await sentUpdate(onUpdate);
        for (const key of ["prepTimeMinutes", "spiceLevel", "clearPrepTime", "clearSpiceLevel"]) expect(payload).not.toHaveProperty(key);
    });

    it("never sends clear flags when creating an item", async () => {
        const { onCreate } = renderModal();
        fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: "Shiro" } });
        const priceBox = screen.getByText("Price (ETB)").parentElement as HTMLElement;
        fireEvent.change(priceBox.querySelector("input") as HTMLInputElement, { target: { value: "150" } });
        const ingredient = screen.getByPlaceholderText("Add ingredient");
        fireEvent.change(ingredient, { target: { value: "chickpeas" } });
        fireEvent.keyDown(ingredient, { key: "Enter" });
        fireEvent.click(screen.getByRole("button", { name: /Save|Create/ }));
        await waitFor(() => expect(onCreate).toHaveBeenCalled());
        const payload = onCreate.mock.calls[0][1] ?? onCreate.mock.calls[0][0];
        expect(payload).not.toHaveProperty("clearPrepTime");
        expect(payload).not.toHaveProperty("clearSpiceLevel");
    });
});
