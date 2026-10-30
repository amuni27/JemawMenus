import { describe, expect, it } from "vitest";
import { GOOGLE_MAPS_URL_MESSAGE, googleMapsUrlProblem, isGoogleMapsUrl } from "./googleMapsUrl";

// AGF-S2-12: the same rules as the backend (which stays authoritative), for immediate messages only.

describe("Google Maps links", () => {
    it.each([
        "https://www.google.com/maps/place/Abol+Cafe/@9.0,38.7,17z",
        "https://google.com/maps?q=9.0,38.7",
        "https://maps.google.com/?q=Bole+Road",
        "https://maps.google.com",
        "https://maps.app.goo.gl/AbC123xyz",
        "https://goo.gl/maps/AbC123xyz",
        "https://maps.app.goo.gl:443/AbC",
        "  https://WWW.Google.com/maps/place/x  ",
    ])("accepts %s", (url) => {
        expect(isGoogleMapsUrl(url)).toBe(true);
        expect(googleMapsUrlProblem(url)).toBeNull();
    });

    it.each([
        "http://www.google.com/maps/place/x", "javascript:alert(1)", "data:text/html,hi", "www.google.com/maps/place/x",
        "https://google.com.evil.example/maps/x", "https://evil.example/maps.google.com", "https://google.com@evil.example/maps",
        "https://user:pass@maps.google.com/x", "https://www.google.com.et/maps/x", "https://google.com.et/maps/x",
        "https://www.google.co.uk/maps/x", "https://evil.maps.google.com/x", "https://www.google.com/search?q=maps",
        "https://maps.app.goo.gl/", "https://goo.gl/xyz", "https://goo.gl/maps/", "https://maps.google.com:8443/x",
        "https://maps.google.com/a b",
    ])("rejects %s with the message", (url) => {
        expect(isGoogleMapsUrl(url)).toBe(false);
        expect(googleMapsUrlProblem(url)).toBe(GOOGLE_MAPS_URL_MESSAGE);
    });

    it("limits links to 2,048 characters", () => {
        const prefix = "https://www.google.com/maps/place/";
        const ok = prefix + "a".repeat(2048 - prefix.length);
        expect(isGoogleMapsUrl(ok)).toBe(true);
        expect(isGoogleMapsUrl(ok + "a")).toBe(false);
    });

    it("treats an empty field as 'no link' (optional)", () => {
        expect(googleMapsUrlProblem("")).toBeNull();
        expect(googleMapsUrlProblem("   ")).toBeNull();
        expect(isGoogleMapsUrl("")).toBe(false);
    });
});
