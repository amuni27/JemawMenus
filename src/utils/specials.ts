// AGF-S2-25 (checkpoint B): specials on the guest page. The backend only sends specials that apply now (active in
// the restaurant's time and below the regular price, D-S2-25-6); the page additionally hides a special once its
// current period ends, so it disappears without a reload (D-S2-25-10).
import { createContext, useContext } from "react";

export type SpecialFields = {
    price?: number | string | null;
    specialPrice?: number | string | null;
    specialNote?: string | null;
    specialNoteAm?: string | null;
    /** End of the current special period (instant); null = doesn't end today */
    specialEndsAt?: string | null;
    /** Local end time today ("HH:mm") when the special has a daily window */
    specialUntil?: string | null;
    /** AGF-S2-36: DISH or CATEGORY (an applicable dish special wins, D-CS-4) */
    specialType?: string | null;
    specialPercent?: number | null;
};

/** AGF-S2-36: a category's active special on guest responses (heading badge, Specials section line) */
export type CategorySpecialInfo = {
    percent: number;
    note?: string | null;
    noteAm?: string | null;
    /** Local end time today ("HH:mm") when it has a daily window */
    until?: string | null;
    /** End of the current period (instant); null = doesn't end today */
    endsAt?: string | null;
};

export function specialApplies(item: SpecialFields, now: Date): boolean {
    if (item.specialPrice == null) return false;
    const regular = Number(item.price);
    if (Number.isFinite(regular) && Number(item.specialPrice) >= regular) return false; // never a "special" at or above the price
    if (item.specialEndsAt) {
        const end = Date.parse(item.specialEndsAt);
        if (Number.isFinite(end) && now.getTime() >= end) return false;
    }
    return true;
}

/** The price a guest sees right now (special while it applies). */
export function shownPrice(item: SpecialFields, now: Date): number {
    return specialApplies(item, now) ? Number(item.specialPrice) : Number(item.price);
}

/** The menu's dishes on special now, in menu order. Category-discounted dishes get a category line instead (AGF-S2-36). */
export function activeSpecials<T extends SpecialFields>(groups: { items: T[] }[], now: Date): T[] {
    return groups.flatMap((g) => g.items.filter((i) => i.specialType !== "CATEGORY" && specialApplies(i, now)));
}

/** AGF-S2-36: a category special applies until the end of its current period (the backend only sends active ones). */
export function categorySpecialApplies(special: CategorySpecialInfo | null | undefined, now: Date): boolean {
    if (!special) return false;
    if (special.endsAt) {
        const end = Date.parse(special.endsAt);
        if (Number.isFinite(end) && now.getTime() >= end) return false;
    }
    return true;
}

/** AGF-S2-36: the menu's categories with an applicable special, in menu order (one Specials line each, D-CS-7). */
export function activeCategorySpecials<G extends { category: { special?: CategorySpecialInfo | null } }>(groups: G[], now: Date): G[] {
    return groups.filter((g) => categorySpecialApplies(g.category.special, now));
}

/** "20% off until 18:00" */
export function categoryBadgeText(special: CategorySpecialInfo): string {
    return `${special.percent}% off${special.until ? ` until ${special.until}` : ""}`;
}

/** The guest page's clock (refreshed while the page is open); falls back to the current time. */
export const GuestClockContext = createContext<Date | null>(null);

export function useGuestNow(): Date {
    return useContext(GuestClockContext) ?? new Date();
}
