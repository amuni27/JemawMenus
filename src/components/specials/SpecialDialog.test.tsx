// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ToastProvider } from "../ui/ToastContext";

// AGF-S2-25 (checkpoint A): create/edit a special. Dishes grouped by menu with their regular price; special price
// below the regular price; optional note (+ Amharic), dates, weekdays and one daily window. New specials send only
// filled fields; edits send changed fields ("" clears the note, clearTimeWindow / clearStartsOn / clearEndsOn).

const { default: SpecialDialog } = await import("./SpecialDialog.tsx");

afterEach(() => cleanup());

const dishes = [
    { id: "i1", name: "Doro Wat", price: 420, menuId: "m1", menuName: "Lunch" },
    { id: "i2", name: "Shiro", price: 220, menuId: "m1", menuName: "Lunch" },
    { id: "i3", name: "Buna", price: 90, menuId: "m2", menuName: "Drinks" },
];

function renderDialog(special?: Record<string, unknown>, onSave = vi.fn().mockResolvedValue(undefined)) {
    render(<ToastProvider><SpecialDialog open onClose={() => {}} dishes={dishes} special={special as never} currency="ETB" onSave={onSave} /></ToastProvider>);
    return onSave;
}

const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
const save = () => fireEvent.click(screen.getByRole("button", { name: /save special|add special/i }));

describe("special dialog", () => {
    it("lists dishes grouped by menu with their regular price", () => {
        renderDialog();
        const select = screen.getByLabelText("Dish") as HTMLSelectElement;
        const groups = [...select.querySelectorAll("optgroup")].map((g) => g.label);
        expect(groups).toEqual(["Lunch", "Drinks"]);
        expect(within(select).getByRole("option", { name: "Doro Wat · ETB 420.00" })).toBeTruthy();
    });

    it("creates a special with only the filled fields, days in week order", async () => {
        const onSave = renderDialog();
        fireEvent.change(screen.getByLabelText("Dish"), { target: { value: "i1" } });
        fireEvent.change(field("Special price (ETB)"), { target: { value: "350" } });
        fireEvent.change(field("Note (optional)"), { target: { value: " Happy hour " } });
        fireEvent.click(screen.getByRole("checkbox", { name: "Fri" }));
        fireEvent.click(screen.getByRole("checkbox", { name: "Mon" }));
        fireEvent.change(field("From"), { target: { value: "16:00" } });
        fireEvent.change(field("Until"), { target: { value: "18:00" } });
        save();
        await waitFor(() => expect(onSave).toHaveBeenCalled());
        expect(onSave.mock.calls[0][0]).toEqual({
            menuItemId: "i1", specialPrice: 350, note: "Happy hour", daysOfWeek: ["MONDAY", "FRIDAY"], startTime: "16:00", endTime: "18:00",
        });
    });

    it("checks the price, dates and times before saving", () => {
        const onSave = renderDialog();
        fireEvent.change(screen.getByLabelText("Dish"), { target: { value: "i1" } });
        fireEvent.change(field("Special price (ETB)"), { target: { value: "420" } });
        fireEvent.change(field("Start date (optional)"), { target: { value: "2026-11-10" } });
        fireEvent.change(field("End date (optional)"), { target: { value: "2026-11-09" } });
        fireEvent.change(field("From"), { target: { value: "18:00" } });
        fireEvent.change(field("Until"), { target: { value: "16:00" } });
        save();
        expect(screen.getByText(/lower than the regular price/)).toBeTruthy();
        expect(screen.getByText("The end date can't be before the start date.")).toBeTruthy();
        expect(screen.getByText("The end time must be after the start time.")).toBeTruthy();
        expect(onSave).not.toHaveBeenCalled();
    });

    it("needs both times for a daily window", () => {
        const onSave = renderDialog();
        fireEvent.change(screen.getByLabelText("Dish"), { target: { value: "i3" } });
        fireEvent.change(field("Special price (ETB)"), { target: { value: "60" } });
        fireEvent.change(field("From"), { target: { value: "16:00" } });
        save();
        expect(screen.getByText("Add an end time too.")).toBeTruthy();
        expect(onSave).not.toHaveBeenCalled();
    });

    it("edits: prefilled, sends only changes, clears note and window", async () => {
        const onSave = renderDialog({
            id: "s1", menuItemId: "i1", specialPrice: 350, note: "Happy hour", noteAm: "ደስታ ሰዓት", startsOn: null, endsOn: "2026-11-30",
            daysOfWeek: ["MONDAY"], startTime: "16:00", endTime: "18:00", paused: false,
        });
        expect((screen.getByLabelText("Dish") as HTMLSelectElement).value).toBe("i1");
        expect(field("Special price (ETB)").value).toBe("350");
        expect(field("Note in Amharic (optional)").value).toBe("ደስታ ሰዓት");
        expect((screen.getByRole("checkbox", { name: "Mon" }) as HTMLInputElement).checked).toBe(true);
        fireEvent.change(field("Note (optional)"), { target: { value: "" } });
        fireEvent.change(field("From"), { target: { value: "" } });
        fireEvent.change(field("Until"), { target: { value: "" } });
        fireEvent.change(field("End date (optional)"), { target: { value: "" } });
        save();
        await waitFor(() => expect(onSave).toHaveBeenCalled());
        expect(onSave.mock.calls[0][0]).toEqual({ note: "", clearTimeWindow: true, clearEndsOn: true });
    });

    it("shows server field errors under the fields", async () => {
        const onSave = vi.fn().mockRejectedValue({ response: { status: 400, data: { message: "Validation failed",
            fieldErrors: [{ field: "menuItemId", message: "This dish already has a special." }] } } });
        renderDialog(undefined, onSave);
        fireEvent.change(screen.getByLabelText("Dish"), { target: { value: "i2" } });
        fireEvent.change(field("Special price (ETB)"), { target: { value: "200" } });
        save();
        expect(await screen.findByText("This dish already has a special.")).toBeTruthy();
    });
});
