import { afterEach, describe, expect, it, vi } from "vitest";
import { FALLBACK_PUBLIC_MENU_BASE, normalizePublicMenuBase, publicMenuBase, publicMenuUrl } from "./publicMenuUrl";

// AGF-S2-20 / D2: the guest menu base URL is configuration (VITE_PUBLIC_MENU_BASE_URL), validated and normalised in
// one place. Unset keeps the address existing QR codes use; invalid values fail closed (no URL, no QR).

const BUSINESS_ID = "00000000-0000-4000-8000-0000000000b1";

afterEach(() => vi.unstubAllEnvs());

const base = (raw: string | undefined) => {
    const r = normalizePublicMenuBase(raw);
    return r.ok ? r.base : null;
};

describe("public menu base URL", () => {
    // AC1
    it("falls back to the current production frontend when unset or empty, byte-for-byte as before", () => {
        expect(FALLBACK_PUBLIC_MENU_BASE).toBe("https://agafari-menu.onrender.com");
        expect(base(undefined)).toBe("https://agafari-menu.onrender.com");
        expect(base("")).toBe("https://agafari-menu.onrender.com");
        expect(base("   ")).toBe("https://agafari-menu.onrender.com");

        vi.stubEnv("VITE_PUBLIC_MENU_BASE_URL", "");
        expect(publicMenuUrl(BUSINESS_ID)).toBe(`https://agafari-menu.onrender.com/${BUSINESS_ID}/menu`);
    });

    // AC2
    it("normalises valid HTTPS values: slashes, host case, default port, path prefix", () => {
        expect(base("https://menu.example.test")).toBe("https://menu.example.test");
        expect(base("https://menu.example.test/")).toBe("https://menu.example.test");
        expect(base("https://Menu.Example.TEST//")).toBe("https://menu.example.test");
        expect(base("https://menu.example.test:443/")).toBe("https://menu.example.test");
        expect(base("https://menu.example.test:8443")).toBe("https://menu.example.test:8443");
        expect(base("https://example.test/menus/")).toBe("https://example.test/menus");
        expect(base("  https://menu.example.test  ")).toBe("https://menu.example.test");

        vi.stubEnv("VITE_PUBLIC_MENU_BASE_URL", "https://example.test/menus/");
        expect(publicMenuUrl(BUSINESS_ID)).toBe(`https://example.test/menus/${BUSINESS_ID}/menu`);
    });

    // AC3
    it("accepts http only for local development hosts", () => {
        expect(base("http://localhost:5175")).toBe("http://localhost:5175");
        expect(base("http://localhost:5175/")).toBe("http://localhost:5175");
        expect(base("http://127.0.0.1:5175")).toBe("http://127.0.0.1:5175");
        expect(base("http://[::1]:5175")).toBe("http://[::1]:5175");
        expect(base("http://demo.localhost:5175")).toBe("http://demo.localhost:5175");
        expect(base("http://menu.example.test")).toBeNull();
        expect(base("http://localhost.example.test")).toBeNull();
    });

    // AC4
    it.each([
        ["schemeless", "agafari-menu.onrender.com"],
        ["relative", "/menu"],
        ["javascript", "javascript:alert(1)"],
        ["data", "data:text/html,hi"],
        ["ftp", "ftp://menu.example.test"],
        ["credentials", "https://u:p@menu.example.test"],
        ["user only", "https://u@menu.example.test"],
        ["query", "https://menu.example.test/?x=1"],
        ["fragment", "https://menu.example.test/#top"],
        ["inner whitespace", "https://menu.example .test"],
        ["empty host", "https://"],
        ["protocol-relative", "//menu.example.test"],
    ])("rejects %s values", (_label, raw) => {
        const r = normalizePublicMenuBase(raw);
        expect(r.ok).toBe(false);
    });

    // AC4
    it("fails closed: an invalid configured value gives no URL instead of the fallback", () => {
        vi.stubEnv("VITE_PUBLIC_MENU_BASE_URL", "ftp://menu.example.test");
        expect(publicMenuBase().ok).toBe(false);
        expect(publicMenuUrl(BUSINESS_ID)).toBeNull();
    });

    it("keeps the /{businessId}/menu path and encodes the id", () => {
        vi.stubEnv("VITE_PUBLIC_MENU_BASE_URL", "http://localhost:5175");
        expect(publicMenuUrl(BUSINESS_ID)).toBe(`http://localhost:5175/${BUSINESS_ID}/menu`);
        expect(publicMenuUrl("a b/c")).toBe("http://localhost:5175/a%20b%2Fc/menu");
    });

    it("still requires a business id", () => {
        expect(() => publicMenuUrl(undefined)).toThrow();
    });
});
