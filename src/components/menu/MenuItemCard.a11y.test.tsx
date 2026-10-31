// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { MenuItemCard } from "./MenuItemCard";

// AGF-S2-27 (A1, A2, A6): the dish name is a keyboard-reachable link to its details; sold-out cards keep their state
// announcements; text is not faded by the sold-out dimming; the placeholder uses a readable colour.

afterEach(cleanup);

const item = { id: "item-1", name: "Doro Wat", description: "Chicken stew", price: 420, status: "AVAILABLE" };

function renderCard(props: Record<string, unknown> = {}) {
    render(
        <MemoryRouter initialEntries={["/biz-1/menu"]}>
            <Routes>
                <Route path="/:tenantSlug/menu" element={<MenuItemCard item={{ ...item, ...props }} currency="ETB" />} />
                <Route path="/:tenantSlug/menu/item/:itemId" element={<p>Detail page</p>} />
            </Routes>
        </MemoryRouter>
    );
}

describe("MenuItemCard accessibility", () => {
    // A6
    it("names the dish with a link to its details that keyboard users can follow", () => {
        renderCard();
        const link = screen.getByRole("link", { name: "Doro Wat" });
        expect(link.getAttribute("href")).toBe("/biz-1/menu/item/item-1");
        link.focus();
        expect(document.activeElement).toBe(link);
        fireEvent.click(link);
        expect(screen.getByText("Detail page")).toBeTruthy();
    });

    // D-S2-27-5 (unchanged behaviour)
    it("keeps sold-out announcements and the disabled add button", () => {
        renderCard({ status: "OUT_OF_STOCK" });
        expect(screen.getByText("Sold Out")).toBeTruthy();
        const button = screen.getByRole("button", { name: "Doro Wat is sold out" }) as HTMLButtonElement;
        expect(button.disabled).toBe(true);
        expect(screen.getByRole("link", { name: "Doro Wat" })).toBeTruthy();
    });

    // A2
    it("dims only the image area of a sold-out card, never its text", () => {
        renderCard({ status: "OUT_OF_STOCK", imageUrl: "https://images.test.invalid/doro.jpg" });
        const description = screen.getByText("Chicken stew");
        expect(description.closest(".opacity-60")).toBeNull();
        expect(screen.getByRole("img", { name: "Doro Wat" }).className).toContain("opacity-60");
    });

    // A1
    it("uses a readable colour for the No image placeholder", () => {
        renderCard();
        const placeholder = screen.getByText("No image");
        expect(placeholder.className).not.toContain("text-gray-400");
        expect(placeholder.className).toContain("text-gray-600");
    });
});
