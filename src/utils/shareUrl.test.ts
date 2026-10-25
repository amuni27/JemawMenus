import { describe, expect, it } from "vitest";
import apiPublic from "../services/apiPublic";
import { shareUrl } from "./shareUrl";

// AGF-S2-21 (D-S2-21-4): the address the owner's Copy link copies is the backend share page, which carries the
// restaurant's preview tags and sends people on to the guest menu.

describe("shareUrl", () => {
    it("points at the public share page on the configured backend", () => {
        const base = String(apiPublic.defaults.baseURL).replace(/\/+$/, "");
        expect(shareUrl("biz-1")).toBe(`${base}/venue/biz-1/share`);
    });

    it("encodes the restaurant id", () => {
        expect(shareUrl("a b/c")).toMatch(/\/venue\/a%20b%2Fc\/share$/);
    });

    it("still requires a restaurant id", () => {
        expect(() => shareUrl(undefined)).toThrow();
    });
});
