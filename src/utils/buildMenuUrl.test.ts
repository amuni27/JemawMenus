import { afterEach, describe, expect, it, vi } from "vitest";
import { buildMenuUrl } from "./buildMenuUrl";

const BUSINESS_ID = "00000000-0000-4000-8000-0000000000b1";

describe("buildMenuUrl", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("keeps the production guest URL when no override is configured", () => {
        vi.stubEnv("VITE_PUBLIC_MENU_BASE_URL", "");
        expect(buildMenuUrl(BUSINESS_ID)).toBe(`https://agafari-menu.onrender.com/${BUSINESS_ID}/menu`);
    });

    // Regression: the local demo's QR and "View Menu" links opened the production site,
    // whose backend was unreachable, so the guest menu stayed on "Loading menu..." forever.
    it("uses VITE_PUBLIC_MENU_BASE_URL so local runs link to the local guest menu", () => {
        vi.stubEnv("VITE_PUBLIC_MENU_BASE_URL", "http://localhost:5175");
        expect(buildMenuUrl(BUSINESS_ID)).toBe(`http://localhost:5175/${BUSINESS_ID}/menu`);

        vi.stubEnv("VITE_PUBLIC_MENU_BASE_URL", "http://localhost:5175/");
        expect(buildMenuUrl(BUSINESS_ID)).toBe(`http://localhost:5175/${BUSINESS_ID}/menu`);
    });

    it("still requires a business id", () => {
        expect(() => buildMenuUrl(undefined)).toThrow();
    });
});
