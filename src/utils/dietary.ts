// Guest dietary filters (AGF-S2-14): a small vocabulary over the owner's free-text tags, and "exclude declared"
// filters over the owner's allergens. Works on the already guest-visible menu, so no API or data change.
import { normalizeSearch } from "./menuSearch";

export type DietKey = "vegetarian" | "vegan" | "fasting" | "gluten-free";

/** Vocabulary order is the chip and badge order. Synonyms are compared after `normalizeTag`. */
export const DIETS: readonly { key: DietKey; label: string; synonyms: readonly string[] }[] = [
    { key: "vegetarian", label: "Vegetarian", synonyms: ["vegetarian", "veg"] },
    { key: "vegan", label: "Vegan", synonyms: ["vegan"] },
    { key: "fasting", label: "Fasting", synonyms: ["fasting", "ye tsom", "yetsom", "tsom", "ፆም", "የፆም"] },
    { key: "gluten-free", label: "Gluten-free", synonyms: ["gluten free", "gf"] },
];

/** Tags the owner form suggests (AGF-S2-14) */
export const DIETARY_TAG_SUGGESTIONS = ["vegetarian", "vegan", "fasting", "gluten-free"] as const;

/** Shown whenever allergen chips are shown (PO decision D-S2-14-4) */
export const ALLERGEN_NOTE =
    "Allergen filters use allergen information reported by the restaurant. Missing information doesn't mean a dish is allergen-free. If you have an allergy, please confirm with the restaurant staff.";

/** Same order as the owner form's allergen suggestions; other allergens follow alphabetically */
const COMMON_ALLERGENS = ["gluten", "dairy", "eggs", "nuts", "peanuts", "soy", "fish", "shellfish", "sesame"];

export type DietaryFilters = { diets: readonly DietKey[]; excluded: readonly string[] };
export const NO_FILTERS: DietaryFilters = { diets: [], excluded: [] };

export type WithDietaryData = { tags?: unknown; allergens?: unknown };

const normalizeTag = (s: string) => normalizeSearch(s).replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();

/** Lists as the API returns them, plus legacy comma-separated strings (as on the item detail page) */
function toList(value: unknown): string[] {
    const parts = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
    return parts.flatMap((v) => (typeof v === "string" ? v.split(",") : [])).map((s) => s.trim()).filter(Boolean);
}

/** Diets the owner tagged, in vocabulary order. Only what was declared: a vegan dish isn't listed as vegetarian. */
export function declaredDiets(item: WithDietaryData): DietKey[] {
    const tags = new Set(toList(item.tags).map(normalizeTag));
    return DIETS.filter((d) => d.synonyms.some((s) => tags.has(normalizeTag(s)))).map((d) => d.key);
}

/** Vegan implies vegetarian. Fasting is independent and implies nothing (PO decision D-S2-14-3). */
export function matchesDiet(item: WithDietaryData, diet: DietKey): boolean {
    const declared = declaredDiets(item);
    return declared.includes(diet) || (diet === "vegetarian" && declared.includes("vegan"));
}

function declaredAllergens(item: WithDietaryData): string[] {
    return toList(item.allergens).map(normalizeSearch);
}

export function hasActiveFilters(f: DietaryFilters): boolean {
    return f.diets.length > 0 || f.excluded.length > 0;
}

/**
 * Every chosen diet must match (AND), and no excluded allergen may be declared. An item without allergen
 * information is kept: it declares nothing to exclude (the guest note explains this isn't "allergen-free").
 */
export function matchesFilters(item: WithDietaryData, f: DietaryFilters): boolean {
    if (!f.diets.every((d) => matchesDiet(item, d))) return false;
    if (f.excluded.length === 0) return true;
    const allergens = declaredAllergens(item);
    return !f.excluded.some((a) => allergens.includes(normalizeSearch(a)));
}

/** Chips worth offering for these items: diets something matches, and allergens something declares */
export function availableChips(items: readonly WithDietaryData[]): { diets: DietKey[]; allergens: string[] } {
    const diets = DIETS.map((d) => d.key).filter((key) => items.some((i) => matchesDiet(i, key)));
    const found = new Set(items.flatMap(declaredAllergens));
    const common = COMMON_ALLERGENS.filter((a) => found.has(a));
    const others = [...found].filter((a) => !COMMON_ALLERGENS.includes(a)).sort();
    return { diets, allergens: [...common, ...others] };
}

export function dietLabel(key: DietKey): string {
    return DIETS.find((d) => d.key === key)?.label ?? key;
}
