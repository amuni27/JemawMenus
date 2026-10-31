// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

// AGF-S2-18: the Duplicate dialog: pre-filled editable name, explanation, a busy state without double submission,
// errors that keep the dialog open (field errors under the name field), Escape / Cancel.

const duplicateMenu = vi.fn();
vi.mock("../../api/menuApi", () => ({ default: { duplicateMenu } }));

const { default: DuplicateMenuDialog } = await import("./DuplicateMenuDialog.tsx");

const menu = { id: "m1", businessId: "biz-1", name: "All-Day Menu", createdAt: "", updatedAt: "" };
const result = { menu: { ...menu, id: "m2", name: "Summer Menu" }, categoriesCopied: 2, itemsCopied: 4, imagesNotCopied: 0 };

const onClose = vi.fn<() => void>();
const onDuplicated = vi.fn<(r: typeof result) => void>();

beforeEach(() => {
    duplicateMenu.mockReset();
    onClose.mockReset();
    onDuplicated.mockReset();
});
afterEach(() => cleanup());

function renderDialog(source = menu) {
    render(<DuplicateMenuDialog menu={source} onClose={onClose} onDuplicated={onDuplicated} />);
    return screen.getByLabelText("Name of the new menu") as HTMLInputElement;
}

describe("DuplicateMenuDialog", () => {
    it("offers '{name} (copy)' in a focused name field and explains what is copied", () => {
        const name = renderDialog();

        expect(screen.getByRole("dialog", { name: "Duplicate menu" })).toBeTruthy();
        expect(name.value).toBe("All-Day Menu (copy)");
        expect(document.activeElement).toBe(name);
        expect(screen.getByText(/new, unpublished menu/i)).toBeTruthy();
        expect(screen.getByText(/sold-out items become available/i)).toBeTruthy();
    });

    it("shortens a long pre-filled name to the 255-character limit", () => {
        const name = renderDialog({ ...menu, name: "L".repeat(255) });

        expect(name.value).toHaveLength(255);
        expect(name.value.endsWith(" (copy)")).toBe(true);
        expect(name.maxLength).toBe(255);
    });

    it("sends the trimmed name once, shows the busy state and reports the result", async () => {
        let resolve: (v: unknown) => void = () => {};
        duplicateMenu.mockReturnValue(new Promise((r) => { resolve = r; }));
        const name = renderDialog();

        fireEvent.change(name, { target: { value: "  Summer Menu  " } });
        fireEvent.click(screen.getByRole("button", { name: "Duplicate" }));

        const busy = await screen.findByRole("button", { name: "Duplicating…" });
        expect((busy as HTMLButtonElement).disabled).toBe(true);
        expect((screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement).disabled).toBe(true);
        expect(name.disabled).toBe(true);
        fireEvent.click(busy);
        fireEvent.submit(name.form!);
        expect(duplicateMenu).toHaveBeenCalledTimes(1);
        expect(duplicateMenu).toHaveBeenCalledWith("m1", "Summer Menu");

        resolve({ data: result });
        await waitFor(() => expect(onDuplicated).toHaveBeenCalledWith(result));
    });

    it("rejects a blank name without calling the server", () => {
        const name = renderDialog();

        fireEvent.change(name, { target: { value: "   " } });
        fireEvent.click(screen.getByRole("button", { name: "Duplicate" }));

        expect(screen.getByText("Enter a name for the new menu.")).toBeTruthy();
        expect(name.getAttribute("aria-invalid")).toBe("true");
        expect(duplicateMenu).not.toHaveBeenCalled();
    });

    it("keeps the dialog open with the server's message when duplicating fails", async () => {
        duplicateMenu.mockRejectedValue({ response: { status: 404, data: { message: "Menu not found" } } });
        renderDialog();

        fireEvent.click(screen.getByRole("button", { name: "Duplicate" }));

        expect((await screen.findByRole("alert")).textContent).toContain("Menu not found");
        expect(onDuplicated).not.toHaveBeenCalled();
        expect(onClose).not.toHaveBeenCalled();
        expect((screen.getByRole("button", { name: "Duplicate" }) as HTMLButtonElement).disabled).toBe(false);
    });

    it("shows a server field error under the name field", async () => {
        duplicateMenu.mockRejectedValue({
            response: { status: 400, data: { message: "Validation failed", fieldErrors: [{ field: "name", message: "size must be between 0 and 255" }] } },
        });
        const name = renderDialog();

        fireEvent.click(screen.getByRole("button", { name: "Duplicate" }));

        expect(await screen.findByText("size must be between 0 and 255")).toBeTruthy();
        expect(name.getAttribute("aria-invalid")).toBe("true");
    });

    it("closes with Cancel or Escape", () => {
        renderDialog();

        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
        fireEvent.keyDown(document, { key: "Escape" });

        expect(onClose).toHaveBeenCalledTimes(2);
        expect(duplicateMenu).not.toHaveBeenCalled();
    });
});
