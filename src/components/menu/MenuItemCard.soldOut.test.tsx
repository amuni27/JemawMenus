// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MenuItemCard } from "./MenuItemCard";

// AGF-S1-13: OUT_OF_STOCK items are shown with a Sold Out indicator and cannot be added.

afterEach(cleanup);

const renderCard = (status: string, onAddItem = vi.fn()) => {
    render(
        <MemoryRouter>
            <MenuItemCard item={{ id: "i1", name: "Tibs", price: 420, status }} currency="ETB" onAddItem={onAddItem} />
        </MemoryRouter>
    );
    return onAddItem;
};

describe("MenuItemCard sold-out state", () => {
    it("shows a visible Sold Out badge for OUT_OF_STOCK items", () => {
        renderCard("OUT_OF_STOCK");
        expect(screen.getByText("Sold Out")).toBeTruthy();
    });

    it("disables the add button with an accessible sold-out label, and clicking does nothing", () => {
        const onAddItem = renderCard("OUT_OF_STOCK");
        const button = screen.getByRole("button", { name: "Tibs is sold out" }) as HTMLButtonElement;

        expect(button.disabled).toBe(true);
        fireEvent.click(button);
        expect(onAddItem).not.toHaveBeenCalled();
    });

    it("leaves AVAILABLE items unchanged: no badge, add button enabled", () => {
        const onAddItem = renderCard("AVAILABLE");

        expect(screen.queryByText("Sold Out")).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "Add Tibs" }));
        expect(onAddItem).toHaveBeenCalledTimes(1);
    });
});
