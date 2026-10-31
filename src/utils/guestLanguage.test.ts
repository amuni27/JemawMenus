import { describe, expect, it } from "vitest";
import { GUEST_LANGUAGE_KEY, hasAmharic, initialLanguage, localized } from "./guestLanguage";

// AGF-S2-23 (checkpoint B): guest language helpers (D-S2-23-3, -4).

describe("guest language", () => {
    it("falls back to the main text field by field", () => {
        expect(localized("Doro Wat", "ዶሮ ወጥ", "am")).toEqual({ text: "ዶሮ ወጥ", lang: "am" });
        expect(localized("Beef Tibs", null, "am")).toEqual({ text: "Beef Tibs", lang: undefined });
        expect(localized("Beef Tibs", "   ", "am")).toEqual({ text: "Beef Tibs", lang: undefined });
        expect(localized("Doro Wat", "ዶሮ ወጥ", "en")).toEqual({ text: "Doro Wat", lang: undefined });
        expect(localized(null, null, "am")).toEqual({ text: "", lang: undefined });
    });

    it("remembers the choice, otherwise follows the browser language", () => {
        expect(initialLanguage("am", "en-US")).toBe("am");
        expect(initialLanguage("en", "am-ET")).toBe("en");
        expect(initialLanguage(null, "am-ET")).toBe("am");
        expect(initialLanguage(null, "am")).toBe("am");
        expect(initialLanguage(null, "en-GB")).toBe("en");
        expect(initialLanguage("fr", undefined)).toBe("en"); // unknown stored value
        expect(GUEST_LANGUAGE_KEY).toBe("agafari:guest-language");
    });

    it("detects any Amharic text in menus, categories or items", () => {
        const menu = (extra: object = {}, cat: object = {}, item: object = {}) =>
            [{ name: "Lunch", ...extra, categories: [{ name: "Mains", ...cat, items: [{ name: "Doro Wat", ...item }] }] }];
        expect(hasAmharic(menu())).toBe(false);
        expect(hasAmharic(menu({ nameAm: " " }))).toBe(false);
        expect(hasAmharic(menu({ nameAm: "ምሳ" }))).toBe(true);
        expect(hasAmharic(menu({}, { nameAm: "ዋና ምግቦች" }))).toBe(true);
        expect(hasAmharic(menu({}, {}, { descriptionAm: "የዶሮ ወጥ" }))).toBe(true);
        expect(hasAmharic([])).toBe(false);
        expect(hasAmharic(undefined)).toBe(false);
    });
});
