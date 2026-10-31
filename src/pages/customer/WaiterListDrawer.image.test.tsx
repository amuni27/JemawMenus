// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { WaiterListDrawer } from "./WaiterListDrawer";

// AGF-S2-16: a waiter-list entry whose saved photo no longer loads (e.g. the owner removed it) shows a placeholder.

afterEach(cleanup);

const entry = (imageUrl?: string) => ({
    i1: { itemId: "i1", quantity: 1, snapshot: { name: "Doro Wat", price: 350, currency: "ETB", imageUrl } },
});

function renderDrawer(imageUrl?: string) {
    render(<WaiterListDrawer open onClose={vi.fn()} waiterList={entry(imageUrl)} onIncrement={vi.fn()}
                             onDecrement={vi.fn()} onRemove={vi.fn()} onClear={vi.fn()} />);
}

describe("WaiterListDrawer photo", () => {
    it("shows the saved photo while it loads", () => {
        renderDrawer("https://images.test.invalid/doro.jpg");
        expect(screen.getByRole("img", { name: "Doro Wat" })).toBeTruthy();
        expect(screen.queryByText("No image")).toBeNull();
    });

    it("replaces a photo that fails to load with 'No image'", () => {
        renderDrawer("https://images.test.invalid/removed.jpg");
        fireEvent.error(screen.getByRole("img", { name: "Doro Wat" }));
        expect(screen.queryByRole("img", { name: "Doro Wat" })).toBeNull();
        expect(screen.getByText("No image")).toBeTruthy();
    });

    it("shows 'No image' when the entry has no photo", () => {
        renderDrawer(undefined);
        expect(screen.getByText("No image")).toBeTruthy();
    });
});
