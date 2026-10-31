// AGF-S2-26: the restaurant's time zone (D-S2-26-1…5), mirroring the backend's TimeZoneRules. Ethiopia is always
// Africa/Addis_Ababa (not shown); US restaurants choose one of seven zones, pre-selected from the state.

export const US_TIME_ZONES: { id: string; label: string }[] = [
    { id: "America/New_York", label: "Eastern" },
    { id: "America/Chicago", label: "Central" },
    { id: "America/Denver", label: "Mountain" },
    { id: "America/Phoenix", label: "Mountain – Arizona (no daylight saving)" },
    { id: "America/Los_Angeles", label: "Pacific" },
    { id: "America/Anchorage", label: "Alaska" },
    { id: "Pacific/Honolulu", label: "Hawaii" },
];

export const US_ZONE_MESSAGE = "Choose a US time zone.";

const STATE_ZONES: Record<string, string[]> = {
    "America/New_York": ["CT", "DE", "DC", "FL", "GA", "IN", "KY", "ME", "MD", "MA", "MI", "NH", "NJ", "NY", "NC", "OH",
        "PA", "RI", "SC", "VT", "VA", "WV"],
    "America/Chicago": ["AL", "AR", "IL", "IA", "KS", "LA", "MN", "MS", "MO", "NE", "ND", "OK", "SD", "TN", "TX", "WI"],
    "America/Denver": ["CO", "ID", "MT", "NM", "UT", "WY"],
    "America/Phoenix": ["AZ"],
    "America/Los_Angeles": ["CA", "NV", "OR", "WA"],
    "America/Anchorage": ["AK"],
    "Pacific/Honolulu": ["HI"],
};

/** The state's main zone, or "" for no or an unknown state. */
export function defaultZoneForState(state?: string | null): string {
    const code = (state ?? "").trim().toUpperCase();
    return Object.entries(STATE_ZONES).find(([, states]) => states.includes(code))?.[0] ?? "";
}

export const isUsZone = (value?: string | null) => US_TIME_ZONES.some((z) => z.id === (value ?? "").trim());

export const timeZoneLabel = (id?: string | null) => US_TIME_ZONES.find((z) => z.id === id)?.label ?? (id ?? "");
