import { describe, expect, it } from "vitest";
import { SUPPORTED_CURRENCIES, displayCurrency, formatPrice } from "./currency";

// AGF-S2-02: one formatter for every price in the admin and guest UIs.

describe("currency helpers", () => {
    it("supports ETB and USD (D6) and falls back to ETB", () => {
        expect(SUPPORTED_CURRENCIES).toEqual(["ETB", "USD"]);
        expect(displayCurrency(undefined)).toBe("ETB");
        expect(displayCurrency("")).toBe("ETB");
        expect(displayCurrency("USD")).toBe("USD");
    });

    it("formats prices with the currency code and two decimals", () => {
        expect(formatPrice(420, "ETB")).toBe("ETB 420.00");
        expect(formatPrice("12.5", "USD")).toBe("USD 12.50");
        expect(formatPrice(9.999, undefined)).toBe("ETB 10.00");
    });
});
