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

/** The menu's dishes on special now, in menu order. */
export function activeSpecials<T extends SpecialFields>(groups: { items: T[] }[], now: Date): T[] {
    return groups.flatMap((g) => g.items.filter((i) => specialApplies(i, now)));
}

/** The guest page's clock (refreshed while the page is open); falls back to the current time. */
export const GuestClockContext = createContext<Date | null>(null);

export function useGuestNow(): Date {
    return useContext(GuestClockContext) ?? new Date();
}
