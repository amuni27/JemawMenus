// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import ItemCard from "./ItemCard";
import StatusBadge from "./StatusBadge";
import type { ItemStatus, MenuItem } from "../../types/menu";

// AGF-S1-12 (owner side): three distinct statuses and one-tap actions on the owner item card.

afterEach(cleanup);

const item = (status: ItemStatus): MenuItem => ({
    id: "i1", menuId: "m1", categoryId: "c1", name: "Tibs", price: 420,
    ingredients: ["beef"], status, createdAt: "", updatedAt: "",
});

const renderCard = (status: ItemStatus) => {
    const handlers = { onEdit: vi.fn(), onToggle: vi.fn(), onSoldOutToggle: vi.fn(), onDelete: vi.fn() };
    render(<ItemCard item={item(status)} {...handlers} />);
    return handlers;
};

describe("StatusBadge", () => {
    it.each([
        ["AVAILABLE", "Available"],
        ["OUT_OF_STOCK", "Sold out"],
        ["UNAVAILABLE", "Unavailable"],
    ] as const)("renders %s as '%s'", (status, label) => {
        render(<StatusBadge status={status} />);
        expect(screen.getByText(label)).toBeTruthy();
    });
});

describe("ItemCard owner actions", () => {
    it("AVAILABLE: offers Hide and Mark sold out", () => {
        const h = renderCard("AVAILABLE");
        fireEvent.click(screen.getByRole("button", { name: "Hide" }));
        fireEvent.click(screen.getByRole("button", { name: "Mark sold out" }));
        expect(h.onToggle).toHaveBeenCalledTimes(1);
        expect(h.onSoldOutToggle).toHaveBeenCalledTimes(1);
        expect(screen.getByText("Available")).toBeTruthy();
    });

    it("OUT_OF_STOCK: shows Sold out badge and offers Back in stock and Hide", () => {
        const h = renderCard("OUT_OF_STOCK");
        expect(screen.getByText("Sold out")).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: "Back in stock" }));
        fireEvent.click(screen.getByRole("button", { name: "Hide" }));
        expect(h.onSoldOutToggle).toHaveBeenCalledTimes(1);
        expect(h.onToggle).toHaveBeenCalledTimes(1);
    });

    it("UNAVAILABLE: offers Show only (no sold-out action for hidden items)", () => {
        renderCard("UNAVAILABLE");
        expect(screen.getByRole("button", { name: "Show" })).toBeTruthy();
        expect(screen.queryByRole("button", { name: "Mark sold out" })).toBeNull();
        expect(screen.queryByRole("button", { name: "Back in stock" })).toBeNull();
    });
});

// AGF-S2-16: an item without a photo shows a neutral placeholder, not a broken image
describe("ItemCard photo", () => {
    it("shows 'No image' and no <img> when the item has no photo", () => {
        renderCard("AVAILABLE");
        expect(screen.getByText("No image")).toBeTruthy();
        expect(screen.queryByRole("img")).toBeNull();
    });

    it("shows the photo when there is one", () => {
        render(<ItemCard item={{ ...item("AVAILABLE"), imageUrl: "https://images.test.invalid/x.jpg" }}
                         onEdit={vi.fn()} onToggle={vi.fn()} onDelete={vi.fn()} />);
        expect((screen.getByRole("img", { name: "Tibs" }) as HTMLImageElement).src).toBe("https://images.test.invalid/x.jpg");
        expect(screen.queryByText("No image")).toBeNull();
    });
});
