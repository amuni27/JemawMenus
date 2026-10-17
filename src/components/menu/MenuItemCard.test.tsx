// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MenuItemCard } from "./MenuItemCard";

// AGF-S1-03 smoke test: proves React component tests run (jsdom + Testing Library).

afterEach(cleanup);

const item = { id: "item-1", name: "Burger", description: "Beef patty", price: "12.5", calories: 640 };

describe("MenuItemCard", () => {
    it("renders the item name, description, currency and price", () => {
        render(
            <MemoryRouter>
                <MenuItemCard item={item} currency="ETB" />
            </MemoryRouter>
        );

        expect(screen.getByText("Burger")).toBeTruthy();
        expect(screen.getByText("Beef patty")).toBeTruthy();
        expect(screen.getByText("ETB")).toBeTruthy();
        expect(screen.getByText("12.50")).toBeTruthy();
        expect(screen.getByText("640 cal")).toBeTruthy();
    });

    it("passes the item to onAddItem when + is clicked", () => {
        const onAddItem = vi.fn();
        render(
            <MemoryRouter>
                <MenuItemCard item={item} onAddItem={onAddItem} />
            </MemoryRouter>
        );

        fireEvent.click(screen.getByRole("button", { name: "Add Burger" }));

        expect(onAddItem).toHaveBeenCalledWith(item);
    });
});
