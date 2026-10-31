import { describe, expect, it } from "vitest";
import { activeSpecials, shownPrice, specialApplies } from "./specials";

// AGF-S2-25 (checkpoint B): the guest side trusts the backend (only applicable specials are sent) and only checks
// the end of the current period, so a special disappears at its end time on an open page (D-S2-25-10).

const now = new Date("2026-11-06T13:30:00Z");

describe("specials on the guest page", () => {
    it("applies while the special has a price and hasn't reached its end", () => {
        expect(specialApplies({ price: 420, specialPrice: 350, specialEndsAt: "2026-11-06T15:00:00Z" }, now)).toBe(true);
        expect(specialApplies({ price: 420, specialPrice: 350, specialEndsAt: null }, now)).toBe(true);
        expect(specialApplies({ price: 420, specialPrice: 350, specialEndsAt: "2026-11-06T13:30:00Z" }, now)).toBe(false); // end is exclusive
        expect(specialApplies({ price: 420 }, now)).toBe(false);
        expect(specialApplies({ price: 420, specialPrice: 420 }, now)).toBe(false); // never a "special" at or above the price
    });

    it("shows the special price while it applies, otherwise the regular price", () => {
        expect(shownPrice({ price: 420, specialPrice: 350 }, now)).toBe(350);
        expect(shownPrice({ price: 420, specialPrice: 350, specialEndsAt: "2026-11-06T12:00:00Z" }, now)).toBe(420);
        expect(shownPrice({ price: "420" }, now)).toBe(420);
    });

    it("collects the menu's dishes on special, in menu order", () => {
        const groups = [
            { items: [{ id: "a", price: 100, specialPrice: 80 }, { id: "b", price: 100 }] },
            { items: [{ id: "c", price: 50, specialPrice: 40, specialEndsAt: "2026-11-06T13:00:00Z" }, { id: "d", price: 60, specialPrice: 45 }] },
        ];
        expect(activeSpecials(groups, now).map((i) => i.id)).toEqual(["a", "d"]);
    });
});
