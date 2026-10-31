// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ToastProvider } from "../ui/ToastContext";

// AGF-S2-36 (checkpoint A): create/edit a category special: a category (grouped by menu), a whole-number percentage
// 1–90, an optional note (+ Amharic) and the same schedule controls as dish specials.

const { default: CategorySpecialDialog } = await import("./CategorySpecialDialog.tsx");

afterEach(() => cleanup());

const categories = [
    { id: "c1", name: "Mains", menuId: "m1", menuName: "Lunch" },
    { id: "c2", name: "Desserts", menuId: "m1", menuName: "Lunch" },
    { id: "c3", name: "Hot drinks", menuId: "m2", menuName: "Drinks" },
];

function renderDialog(special?: Record<string, unknown>, onSave = vi.fn().mockResolvedValue(undefined)) {
    render(<ToastProvider><CategorySpecialDialog open onClose={() => {}} categories={categories} special={special as never} onSave={onSave} /></ToastProvider>);
    return onSave;
}

const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
const save = () => fireEvent.click(screen.getByRole("button", { name: /save category special|add category special/i }));

describe("category special dialog", () => {
    it("lists categories grouped by menu and explains the precedence rule", () => {
        renderDialog();
        const select = screen.getByLabelText("Category") as HTMLSelectElement;
        expect([...select.querySelectorAll("optgroup")].map((g) => g.label)).toEqual(["Lunch", "Drinks"]);
        expect(screen.getByText(/Dishes with their own special keep it/)).toBeTruthy();
    });

    it("creates a category special with only the filled fields", async () => {
        const onSave = renderDialog();
        fireEvent.change(screen.getByLabelText("Category"), { target: { value: "c2" } });
        fireEvent.change(field("Discount (%)"), { target: { value: "20" } });
        fireEvent.change(field("Note (optional)"), { target: { value: " Sweet hour " } });
        fireEvent.click(screen.getByRole("checkbox", { name: "Fri" }));
        fireEvent.change(field("From"), { target: { value: "16:00" } });
        fireEvent.change(field("Until"), { target: { value: "18:00" } });
        save();
        await waitFor(() => expect(onSave).toHaveBeenCalled());
        expect(onSave.mock.calls[0][0]).toEqual({
            categoryId: "c2", discountPercent: 20, note: "Sweet hour", daysOfWeek: ["FRIDAY"], startTime: "16:00", endTime: "18:00",
        });
    });

    it("needs a whole percentage from 1 to 90", () => {
        const onSave = renderDialog();
        fireEvent.change(screen.getByLabelText("Category"), { target: { value: "c2" } });
        for (const value of ["0", "91", "12.5", ""]) {
            fireEvent.change(field("Discount (%)"), { target: { value } });
            save();
            expect(screen.getByText(value === "" ? "Enter the discount percentage." : "Use a whole number from 1 to 90.")).toBeTruthy();
        }
        expect(onSave).not.toHaveBeenCalled();
    });

    it("edits: prefilled, sends only changes", async () => {
        const onSave = renderDialog({ id: "cs1", categoryId: "c2", discountPercent: 20, note: "Sweet hour", noteAm: null,
            startsOn: null, endsOn: null, daysOfWeek: [], startTime: "16:00", endTime: "18:00", paused: false });
        expect((screen.getByLabelText("Category") as HTMLSelectElement).value).toBe("c2");
        expect(field("Discount (%)").value).toBe("20");
        fireEvent.change(field("Discount (%)"), { target: { value: "25" } });
        fireEvent.change(field("From"), { target: { value: "" } });
        fireEvent.change(field("Until"), { target: { value: "" } });
        save();
        await waitFor(() => expect(onSave).toHaveBeenCalled());
        expect(onSave.mock.calls[0][0]).toEqual({ discountPercent: 25, clearTimeWindow: true });
    });

    it("shows server field errors", async () => {
        const onSave = vi.fn().mockRejectedValue({ response: { status: 400, data: { message: "Validation failed",
            fieldErrors: [{ field: "categoryId", message: "This category already has a category special." }] } } });
        renderDialog(undefined, onSave);
        fireEvent.change(screen.getByLabelText("Category"), { target: { value: "c1" } });
        fireEvent.change(field("Discount (%)"), { target: { value: "10" } });
        save();
        expect(await screen.findByText("This category already has a category special.")).toBeTruthy();
    });
});
