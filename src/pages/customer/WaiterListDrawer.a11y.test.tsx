// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { WaiterListDrawer } from "./WaiterListDrawer";

// AGF-S2-27 (A5, A7): the waiter list is a labelled modal dialog. Focus moves into it, stays inside, Escape closes it
// and focus returns to the control that opened it. Every control has a name, including "Remove {dish}".

afterEach(cleanup);

const list = {
    i1: { itemId: "i1", quantity: 1, snapshot: { name: "Doro Wat", price: 420, currency: "ETB" } },
    i2: { itemId: "i2", quantity: 2, snapshot: { name: "Beef Tibs", price: 380, currency: "ETB" } },
};

function Harness({ onRemove = vi.fn() }: { onRemove?: (id: string) => void }) {
    const [open, setOpen] = useState(false);
    return (
        <>
            <button type="button" onClick={() => setOpen(true)}>View order</button>
            <WaiterListDrawer open={open} onClose={() => setOpen(false)} waiterList={list}
                              onIncrement={vi.fn()} onDecrement={vi.fn()} onRemove={onRemove} onClear={vi.fn()} />
        </>
    );
}

function openDrawer() {
    const opener = screen.getByRole("button", { name: "View order" });
    opener.focus();
    fireEvent.click(opener);
    return opener;
}

describe("WaiterListDrawer accessibility", () => {
    it("is a modal dialog labelled by its title, with focus moved inside", () => {
        render(<Harness />);
        openDrawer();
        const dialog = screen.getByRole("dialog", { name: "Waiter List" });
        expect(dialog.getAttribute("aria-modal")).toBe("true");
        expect(dialog.contains(document.activeElement)).toBe(true);
    });

    it("names every remove button after its dish", () => {
        const onRemove = vi.fn();
        render(<Harness onRemove={onRemove} />);
        openDrawer();
        fireEvent.click(screen.getByRole("button", { name: "Remove Beef Tibs" }));
        expect(onRemove).toHaveBeenCalledWith("i2");
        expect(screen.getByRole("button", { name: "Remove Doro Wat" })).toBeTruthy();
    });

    it("keeps Tab and Shift+Tab inside the dialog", () => {
        render(<Harness />);
        openDrawer();
        const dialog = screen.getByRole("dialog");
        const focusables = Array.from(dialog.querySelectorAll<HTMLElement>("button:not([disabled])"));
        focusables[focusables.length - 1].focus();
        fireEvent.keyDown(document.activeElement!, { key: "Tab" });
        expect(document.activeElement).toBe(focusables[0]);
        fireEvent.keyDown(document.activeElement!, { key: "Tab", shiftKey: true });
        expect(document.activeElement).toBe(focusables[focusables.length - 1]);
    });

    it("closes with Escape and returns focus to the control that opened it", () => {
        render(<Harness />);
        const opener = openDrawer();
        expect(screen.getByRole("dialog", { name: "Waiter List" }).contains(document.activeElement)).toBe(true);
        fireEvent.keyDown(document.activeElement!, { key: "Escape" });
        expect(screen.queryByRole("dialog")).toBeNull();
        expect(document.activeElement).toBe(opener);
    });

    it("has no focusable backdrop duplicating the Close button", () => {
        render(<Harness />);
        openDrawer();
        expect(screen.getAllByRole("button", { name: "Close waiter list" })).toHaveLength(1);
    });
});
