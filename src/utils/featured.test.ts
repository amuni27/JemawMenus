import { describe, expect, it } from "vitest";
import { featuredItems, isFeatured } from "./featured";

// AGF-S2-15: which items belong in the guest "Chef's picks" section

describe("isFeatured", () => {
    it("reads the response name and the older request-shaped name", () => {
        expect(isFeatured({ featured: true })).toBe(true);
        expect(isFeatured({ isFeatured: true })).toBe(true);
    });

    it("treats false, absent or non-boolean values as not featured", () => {
        expect(isFeatured({ featured: false })).toBe(false);
        expect(isFeatured({})).toBe(false);
        expect(isFeatured({ featured: "true" })).toBe(false);
        expect(isFeatured(null)).toBe(false);
    });
});

describe("featuredItems", () => {
    it("keeps the menu order: category order first, then item order", () => {
        const groups = [
            { items: [{ id: "a", featured: true }, { id: "b" }, { id: "c", featured: true }] },
            { items: [] },
            { items: [{ id: "d", isFeatured: true }] },
        ];
        expect(featuredItems(groups).map((i) => i.id)).toEqual(["a", "c", "d"]);
    });

    it("returns the same item objects, not copies", () => {
        const item = { id: "a", featured: true };
        expect(featuredItems([{ items: [item] }])[0]).toBe(item);
    });

    it("is empty when nothing is featured", () => {
        expect(featuredItems([{ items: [{ id: "a" }] }])).toEqual([]);
        expect(featuredItems([])).toEqual([]);
    });
});
