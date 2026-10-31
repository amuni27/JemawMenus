import { describe, expect, it } from "vitest";
import { COUNTRIES, US_STATES, countryOf, isUsZip, phoneMatchesCountry, usZipProblem } from "./countryRules";

// AGF-S2-12 CR1: the frontend mirrors the backend country rules for immediate messages (backend authoritative).

describe("country rules", () => {
    it("offers only Ethiopia and the United States, Ethiopia first (D-CR1-1)", () => {
        expect(COUNTRIES.map((c) => c.code)).toEqual(["ET", "US"]);
    });

    it("treats a missing or unknown country as Ethiopia", () => {
        expect(countryOf(undefined)).toBe("ET");
        expect(countryOf(null)).toBe("ET");
        expect(countryOf("us")).toBe("US");
        expect(countryOf("KE")).toBe("ET");
    });

    it("lists the 50 states and DC by 2-letter code (D-CR1-6)", () => {
        expect(US_STATES).toHaveLength(51);
        expect(US_STATES.find((s) => s.code === "DC")?.name).toBe("District of Columbia");
        expect(new Set(US_STATES.map((s) => s.code)).size).toBe(51);
    });

    it("accepts 12345 and 12345-6789 ZIP codes only", () => {
        for (const ok of ["10118", "10118-0110", " 90001 "]) expect(isUsZip(ok)).toBe(true);
        for (const bad of ["", "1011", "101180", "ABCDE", "10118-01"]) expect(isUsZip(bad)).toBe(false);
        expect(usZipProblem("")).toBeNull(); // empty: required, but no format message yet
        expect(usZipProblem("1011")).toMatch(/12345 or 12345-6789/);
    });

    it("matches the business phone to the country", () => {
        expect(phoneMatchesCountry("ET", "+251911223344")).toBe(true);
        expect(phoneMatchesCountry("ET", "+12125550100")).toBe(false);
        expect(phoneMatchesCountry("US", "+12125550100")).toBe(true);
        expect(phoneMatchesCountry("US", "+251911223344")).toBe(false);
    });
});
