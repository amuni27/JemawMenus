import { describe, expect, it } from "vitest";
import { businessInitials } from "./initials";

// AGF-S2-01: the logo fallback badge shows the restaurant's initials.
describe("businessInitials", () => {
    it("uses the first letters of the first two words", () => {
        expect(businessInitials("Abol Demo Café")).toBe("AD");
        expect(businessInitials("  kaldi's   coffee ")).toBe("KC");
        expect(businessInitials("Tomoca")).toBe("T");
    });

    it("handles non-Latin names and missing names", () => {
        expect(businessInitials("ቶሞካ ቡና")).toBe("ቶቡ");
        expect(businessInitials("")).toBe("?");
        expect(businessInitials(undefined)).toBe("?");
    });
});
