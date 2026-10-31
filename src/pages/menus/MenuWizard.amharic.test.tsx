// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "../../components/ui/ToastContext";

// AGF-S2-23 (checkpoint A): the menu form has an optional Amharic name, sent when filled (new) or changed (edit; "" clears).

const listMenuTypes = vi.fn().mockResolvedValue({ data: [{ id: "mt-lunch", name: "Lunch" }] });
vi.mock("../../api/menuApi", () => ({ default: { listMenuTypes } }));

const { default: MenuWizard } = await import("./MenuWizard.tsx");

afterEach(() => cleanup());

function renderWizard(initial?: Record<string, unknown>) {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<ToastProvider><MemoryRouter><MenuWizard initial={initial as never} onSave={onSave} /></MemoryRouter></ToastProvider>);
    return onSave;
}

const nameAm = () => screen.getByLabelText("Name in Amharic (optional)") as HTMLInputElement;
const submit = () => fireEvent.click(screen.getByRole("button", { name: /save|create|update/i }));

describe("menu form: Amharic", () => {
    it("sends the Amharic name of a new menu", async () => {
        const onSave = renderWizard();
        await screen.findByRole("option", { name: "Lunch" });
        fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: "Lunch" } });
        fireEvent.change(screen.getByLabelText("Menu Type"), { target: { value: "mt-lunch" } });
        fireEvent.change(nameAm(), { target: { value: " ምሳ " } });
        submit();
        await waitFor(() => expect(onSave).toHaveBeenCalled());
        expect(onSave.mock.calls[0][0]).toMatchObject({ name: "Lunch", nameAm: "ምሳ" });
    });

    it("shows a saved Amharic name and sends an emptied one as a clear", async () => {
        const onSave = renderWizard({ name: "Lunch", menuTypeId: "mt-lunch", nameAm: "ምሳ", visibility: "PUBLIC", isActive: true });
        await screen.findByRole("option", { name: "Lunch" });
        expect(nameAm().value).toBe("ምሳ");
        fireEvent.change(nameAm(), { target: { value: "" } });
        submit();
        await waitFor(() => expect(onSave).toHaveBeenCalled());
        expect(onSave.mock.calls[0][0]).toMatchObject({ nameAm: "" });
    });
});
