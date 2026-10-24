// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "../ui/ToastContext";
import type { Category } from "../../types/menu";

// AGF-S2-14: the owner's Tags field suggests the dietary vocabulary guests can filter by.

const { default: ItemModal } = await import("./ItemModal.tsx");

afterEach(() => cleanup());

const category: Category = { id: "c1", menuId: "m1", name: "Mains", isActive: true, sortOrder: 0, createdAt: "", updatedAt: "" };

function renderModal() {
    render(
        <ToastProvider>
            <MemoryRouter>
                <ItemModal open onClose={() => {}} menuId="m1" categories={[category]} currency="ETB"
                           onCreate={vi.fn()} onUpdate={vi.fn()} onConfirmImage={vi.fn()} />
            </MemoryRouter>
        </ToastProvider>
    );
}

const tagsBox = () => screen.getByRole("group", { name: "Tags" });
const allergensBox = () => screen.getByRole("group", { name: "Allergens" });

describe("item form: dietary tags", () => {
    it("suggests vegetarian, vegan, fasting and gluten-free as tags", () => {
        renderModal();
        for (const tag of ["vegetarian", "vegan", "fasting", "gluten-free"])
            expect(within(tagsBox()).getByRole("button", { name: `Add ${tag}` })).toBeTruthy();
    });

    it("adds a suggested tag as a pill", () => {
        renderModal();
        fireEvent.click(within(tagsBox()).getByRole("button", { name: "Add fasting" }));
        expect(within(tagsBox()).getByRole("button", { name: "Remove fasting" })).toBeTruthy();
        expect(within(tagsBox()).queryByRole("button", { name: "Add fasting" })).toBeNull();
    });

    it("explains that guests filter by these tags and that fasting adds nothing else", () => {
        renderModal();
        expect(tagsBox().getAttribute("aria-describedby")).toBeTruthy();
        expect(within(tagsBox()).getByText(
            "Guests can filter by vegetarian, vegan, fasting and gluten-free. Add each tag that applies; fasting doesn't add vegan or vegetarian."
        )).toBeTruthy();
        expect(within(allergensBox()).getByText(
            "Guests can exclude dishes by declared allergen, so list every allergen the dish contains."
        )).toBeTruthy();
    });
});
