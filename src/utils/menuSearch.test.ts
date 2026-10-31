import { describe, expect, it } from "vitest";
import { itemMatches, normalizeSearch } from "./menuSearch";

// AGF-S2-05: guest search over item name, description and ingredients; case- and accent-insensitive.

const tibs = { name: "Special Tibs", description: "Sautéed beef with rosemary", ingredients: ["Beef", "Jalapeño", "Onion"] };

describe("normalizeSearch", () => {
    it("lower-cases, strips accents and collapses spaces", () => {
        expect(normalizeSearch("  Café   AU Lait ")).toBe("cafe au lait");
        expect(normalizeSearch("JALAPEÑO crème brûlée")).toBe("jalapeno creme brulee");
        expect(normalizeSearch(null)).toBe("");
    });

    it("keeps non-Latin text searchable", () => {
        expect(normalizeSearch("ዶሮ ወጥ")).toBe("ዶሮ ወጥ");
    });
});

describe("itemMatches", () => {
    it("matches the name, description or an ingredient", () => {
        expect(itemMatches(tibs, "tibs")).toBe(true);
        expect(itemMatches(tibs, "rosemary")).toBe(true);
        expect(itemMatches(tibs, "onion")).toBe(true);
        expect(itemMatches(tibs, "chicken")).toBe(false);
    });

    it("ignores case and accents on both sides", () => {
        expect(itemMatches(tibs, "TIBS")).toBe(true);
        expect(itemMatches(tibs, "sauteed")).toBe(true);
        expect(itemMatches(tibs, "jalapeno")).toBe(true);
        expect(itemMatches({ name: "Cafe Latte" }, "café")).toBe(true);
    });

    it("needs every word, in any order and across fields", () => {
        expect(itemMatches(tibs, "beef special")).toBe(true);
        expect(itemMatches(tibs, "tibs onion")).toBe(true);
        expect(itemMatches(tibs, "tibs chicken")).toBe(false);
    });

    it("matches everything for a blank query and copes with missing fields", () => {
        expect(itemMatches(tibs, "   ")).toBe(true);
        expect(itemMatches({ name: "Shiro" }, "shiro")).toBe(true);
        expect(itemMatches({ name: undefined, description: null, ingredients: null }, "x")).toBe(false);
    });

    it("matches Amharic names", () => {
        expect(itemMatches({ name: "ዶሮ ወጥ" }, "ዶሮ")).toBe(true);
    });

    // AGF-S2-23: Amharic names and descriptions are searched too, whatever language is selected
    it("finds items by their Amharic name or description", () => {
        const doro = { name: "Doro Wat", description: "Chicken stew", nameAm: "ዶሮ ወጥ", descriptionAm: "የዶሮ ወጥ ከእንጀራ ጋር" };
        expect(itemMatches(doro, "ዶሮ")).toBe(true);
        expect(itemMatches(doro, "እንጀራ")).toBe(true);
        expect(itemMatches(doro, "doro")).toBe(true);
        expect(itemMatches(doro, "ሽሮ")).toBe(false);
    });
});
