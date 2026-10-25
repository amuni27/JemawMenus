import { describe, expect, it } from "vitest";
import { formatSubdomain } from "./subdomain";

// AGF-S2-10: show the stored subdomain as-is, never with a second domain appended.

describe("formatSubdomain", () => {
    it("shows a stored full host unchanged", () => {
        expect(formatSubdomain("abol.example.com")).toBe("abol.example.com");
        expect(formatSubdomain("abol-demo.demo.agafari.test")).toBe("abol-demo.demo.agafari.test");
    });

    it("shows a bare label as-is without inventing a domain", () => {
        expect(formatSubdomain("abol")).toBe("abol");
    });

    it("tidies whitespace, protocol, trailing slashes and case", () => {
        expect(formatSubdomain("  https://Abol.Example.com/ ")).toBe("abol.example.com");
        expect(formatSubdomain("http://abol.example.com//")).toBe("abol.example.com");
    });

    it("returns null for missing values", () => {
        expect(formatSubdomain(undefined)).toBeNull();
        expect(formatSubdomain(null)).toBeNull();
        expect(formatSubdomain("   ")).toBeNull();
    });
});
