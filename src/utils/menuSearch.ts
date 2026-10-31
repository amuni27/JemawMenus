// Guest menu search (AGF-S2-05): client-side over the already-loaded guest menu, which contains
// only published, public menus and guest-visible items.

export type Searchable = {
    name?: string | null;
    description?: string | null;
    ingredients?: (string | null | undefined)[] | null;
    /** AGF-S2-23: searched too, whatever language is selected */
    nameAm?: string | null;
    descriptionAm?: string | null;
};

/** Lower-case, accents removed ("Café" → "cafe"), whitespace collapsed. Non-Latin scripts are kept as-is. */
export function normalizeSearch(text?: string | null): string {
    return (text ?? "")
        .normalize("NFD")
        .replace(/\p{Mn}/gu, "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
}

/** True when every word of the query appears in the item's name, description or ingredients (or their Amharic text). */
export function itemMatches(item: Searchable, query: string): boolean {
    const words = normalizeSearch(query).split(" ").filter(Boolean);
    if (words.length === 0) return true;
    const haystack = normalizeSearch([item.name, item.description, item.nameAm, item.descriptionAm, ...(item.ingredients ?? [])].filter(Boolean).join(" "));
    return words.every((w) => haystack.includes(w));
}
