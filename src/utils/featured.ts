/**
 * AGF-S2-15: items the owner marked as featured ("Chef's picks").
 * Responses name the flag "featured"; "isFeatured" is the request name, kept for older shapes (as in S2-06).
 */
export function isFeatured(item: unknown): boolean {
    if (!item || typeof item !== "object") return false;
    const i = item as { featured?: unknown; isFeatured?: unknown };
    return i.featured === true || i.isFeatured === true;
}

/**
 * The featured items of already guest-visible category groups, in menu order (category order, then item order).
 * Returns the same item objects, so nothing is copied.
 */
export function featuredItems<T>(groups: { items: T[] }[]): T[] {
    return groups.flatMap((g) => g.items.filter(isFeatured));
}
