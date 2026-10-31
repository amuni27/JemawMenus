import { describe, expect, it } from "vitest";
import { US_TIME_ZONES, defaultZoneForState, timeZoneLabel } from "./timeZones";
import { US_STATES } from "./countryRules";

// AGF-S2-26: the seven US zones (D-S2-26-3) and the state defaults (D-S2-26-4), mirroring the backend.

describe("US time zones", () => {
    it("offers the seven zones in order, with labels", () => {
        expect(US_TIME_ZONES.map((z) => z.id)).toEqual(["America/New_York", "America/Chicago", "America/Denver",
            "America/Phoenix", "America/Los_Angeles", "America/Anchorage", "Pacific/Honolulu"]);
        expect(timeZoneLabel("America/Phoenix")).toBe("Mountain – Arizona (no daylight saving)");
        expect(timeZoneLabel("Africa/Addis_Ababa")).toBe("Africa/Addis_Ababa");
    });

    it("pre-selects every state's main zone", () => {
        for (const s of US_STATES) expect(US_TIME_ZONES.map((z) => z.id)).toContain(defaultZoneForState(s.code));
        expect(defaultZoneForState("NY")).toBe("America/New_York");
        expect(defaultZoneForState("tx")).toBe("America/Chicago");
        expect(defaultZoneForState("AZ")).toBe("America/Phoenix");
        expect(defaultZoneForState("HI")).toBe("Pacific/Honolulu");
        expect(defaultZoneForState("")).toBe("");
    });
});
