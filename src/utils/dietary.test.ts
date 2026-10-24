import { describe, expect, it } from "vitest";
import {
    ALLERGEN_NOTE,
    availableChips,
    declaredDiets,
    hasActiveFilters,
    matchesDiet,
    matchesFilters,
    NO_FILTERS,
} from "./dietary";

// AGF-S2-14: dietary vocabulary over the owner's free-text tags, and allergen exclusion over declared allergens.

const item = (tags: unknown, allergens: unknown = []) => ({ tags, allergens });

describe("declaredDiets", () => {
    it("recognises the vocabulary regardless of case, accents, hyphens and synonyms", () => {
        expect(declaredDiets(item(["Vegetarian"]))).toEqual(["vegetarian"]);
        expect(declaredDiets(item(["VEG"]))).toEqual(["vegetarian"]);
        expect(declaredDiets(item([" vegan "]))).toEqual(["vegan"]);
        expect(declaredDiets(item(["Gluten Free"]))).toEqual(["gluten-free"]);
        expect(declaredDiets(item(["gluten-free"]))).toEqual(["gluten-free"]);
        expect(declaredDiets(item(["GF"]))).toEqual(["gluten-free"]);
        expect(declaredDiets(item(["Yetsom"]))).toEqual(["fasting"]);
        expect(declaredDiets(item(["ye tsom"]))).toEqual(["fasting"]);
        expect(declaredDiets(item(["ፆም"]))).toEqual(["fasting"]);
        expect(declaredDiets(item(["የፆም"]))).toEqual(["fasting"]);
    });

    it("splits legacy comma-separated values", () => {
        expect(declaredDiets(item("vegetarian, spicy"))).toEqual(["vegetarian"]);
        expect(declaredDiets(item(["vegan,fasting"]))).toEqual(["vegan", "fasting"]);
    });

    it("ignores tags outside the vocabulary and missing data", () => {
        expect(declaredDiets(item(["chef's pick", "spicy"]))).toEqual([]);
        expect(declaredDiets(item(undefined))).toEqual([]);
        expect(declaredDiets(item(null))).toEqual([]);
    });

    it("lists only what the owner declared, in vocabulary order (a vegan dish is not badged vegetarian)", () => {
        expect(declaredDiets(item(["gluten-free", "fasting", "vegan"]))).toEqual(["vegan", "fasting", "gluten-free"]);
        expect(declaredDiets(item(["vegan"]))).toEqual(["vegan"]);
    });
});

describe("matchesDiet", () => {
    it("vegan implies vegetarian", () => {
        expect(matchesDiet(item(["vegan"]), "vegetarian")).toBe(true);
        expect(matchesDiet(item(["vegetarian"]), "vegan")).toBe(false);
    });

    it("fasting is independent: it implies neither vegan nor vegetarian", () => {
        const fastingOnly = item(["fasting"]);
        expect(matchesDiet(fastingOnly, "fasting")).toBe(true);
        expect(matchesDiet(fastingOnly, "vegan")).toBe(false);
        expect(matchesDiet(fastingOnly, "vegetarian")).toBe(false);
        expect(matchesDiet(item(["vegan"]), "fasting")).toBe(false);
    });

    it("needs the owner's explicit extra tags for a fasting dish to count as vegan", () => {
        expect(matchesDiet(item(["fasting", "vegan"]), "vegan")).toBe(true);
        expect(matchesDiet(item(["fasting", "vegan"]), "vegetarian")).toBe(true);
    });
});

describe("matchesFilters", () => {
    it("matches everything with no filters", () => {
        expect(hasActiveFilters(NO_FILTERS)).toBe(false);
        expect(matchesFilters(item([]), NO_FILTERS)).toBe(true);
    });

    it("combines dietary chips with AND", () => {
        const f = { diets: ["vegan", "gluten-free"] as const, excluded: [] };
        expect(matchesFilters(item(["vegan", "gf"]), f)).toBe(true);
        expect(matchesFilters(item(["vegan"]), f)).toBe(false);
    });

    it("excludes items whose declared allergens include an excluded one (case-insensitive)", () => {
        const f = { diets: [], excluded: ["nuts"] };
        expect(matchesFilters(item([], ["Nuts", "dairy"]), f)).toBe(false);
        expect(matchesFilters(item([], ["dairy"]), f)).toBe(true);
    });

    it("keeps items without allergen information: missing data is not allergen-free, but it isn't declared either", () => {
        const f = { diets: [], excluded: ["gluten"] };
        expect(matchesFilters(item([], []), f)).toBe(true);
        expect(matchesFilters(item([], undefined), f)).toBe(true);
        expect(matchesFilters(item([], null), f)).toBe(true);
    });

    it("combines dietary chips and allergen exclusions", () => {
        const f = { diets: ["vegan"] as const, excluded: ["nuts"] };
        expect(matchesFilters(item(["vegan"], ["sesame"]), f)).toBe(true);
        expect(matchesFilters(item(["vegan"], ["nuts"]), f)).toBe(false);
        expect(matchesFilters(item(["fasting"], []), f)).toBe(false);
    });
});

describe("availableChips", () => {
    it("offers only chips that would match something", () => {
        const chips = availableChips([item(["fasting"], ["Gluten"]), item(["chef's pick"], ["nuts", "gluten"])]);
        expect(chips.diets).toEqual(["fasting"]);
        expect(chips.allergens).toEqual(["gluten", "nuts"]); // common allergens first, de-duplicated, lower case
    });

    it("offers Vegetarian when only vegan dishes exist (they match it)", () => {
        expect(availableChips([item(["vegan"])]).diets).toEqual(["vegetarian", "vegan"]);
    });

    it("lists uncommon allergens after the common ones, alphabetically", () => {
        expect(availableChips([item([], ["mustard", "dairy", "celery"])]).allergens).toEqual(["dairy", "celery", "mustard"]);
    });

    it("offers nothing without data", () => {
        expect(availableChips([item([], [])])).toEqual({ diets: [], allergens: [] });
    });
});

describe("allergen note", () => {
    it("says the information is restaurant-reported, missing data isn't allergen-free, and to confirm with staff", () => {
        expect(ALLERGEN_NOTE).toBe(
            "Allergen filters use allergen information reported by the restaurant. Missing information doesn't mean a dish is allergen-free. If you have an allergy, please confirm with the restaurant staff."
        );
    });
});
