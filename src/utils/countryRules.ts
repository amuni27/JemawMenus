// AGF-S2-12 CR1: country-specific location rules, mirroring the backend's CountryRules for immediate messages
// (the backend stays authoritative). Ethiopia: Google Maps link required, no street/city/region/postal code.
// United States: street, city, state and ZIP required, link optional. Only these two countries (D-CR1-1).

export type CountryCode = "ET" | "US";

export const COUNTRIES: { code: CountryCode; name: string }[] = [
    { code: "ET", name: "Ethiopia" },
    { code: "US", name: "United States" },
];

/** A missing or unsupported value means Ethiopia (every restaurant before CR1 was Ethiopian). */
export function countryOf(value?: string | null): CountryCode {
    return value?.trim().toUpperCase() === "US" ? "US" : "ET";
}

export const countryName = (code: CountryCode) => COUNTRIES.find((c) => c.code === code)!.name;

export const LINK_REQUIRED_MESSAGE = "Add your restaurant's Google Maps link.";
export const LINK_KEEP_MESSAGE = "Restaurants in Ethiopia need a Google Maps link. Replace it instead of removing it.";
export const STREET_MESSAGE = "Street address is required.";
export const CITY_MESSAGE = "City is required.";
export const STATE_MESSAGE = "Choose a US state.";
export const ZIP_MESSAGE = "Enter a ZIP code like 12345 or 12345-6789.";

/** The 50 states and the District of Columbia, stored by 2-letter code (D-CR1-6). */
export const US_STATES: { code: string; name: string }[] = [
    ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"], ["CA", "California"], ["CO", "Colorado"],
    ["CT", "Connecticut"], ["DE", "Delaware"], ["DC", "District of Columbia"], ["FL", "Florida"], ["GA", "Georgia"],
    ["HI", "Hawaii"], ["ID", "Idaho"], ["IL", "Illinois"], ["IN", "Indiana"], ["IA", "Iowa"], ["KS", "Kansas"],
    ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"], ["MD", "Maryland"], ["MA", "Massachusetts"],
    ["MI", "Michigan"], ["MN", "Minnesota"], ["MS", "Mississippi"], ["MO", "Missouri"], ["MT", "Montana"],
    ["NE", "Nebraska"], ["NV", "Nevada"], ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"],
    ["NY", "New York"], ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"], ["OK", "Oklahoma"],
    ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"], ["SC", "South Carolina"], ["SD", "South Dakota"],
    ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"], ["WA", "Washington"],
    ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"],
].map(([code, name]) => ({ code, name }));

export const isUsState = (value?: string | null) => !!value && US_STATES.some((s) => s.code === value.trim().toUpperCase());

export const isUsZip = (value?: string | null) => /^\d{5}(-\d{4})?$/.test((value ?? "").trim());

/** Format message for a typed ZIP; null when empty (required is shown by the form) or valid. */
export const usZipProblem = (value?: string | null) => (!(value ?? "").trim() || isUsZip(value) ? null : ZIP_MESSAGE);

/** International phone for the country: ET +251 and 9 digits, US +1 and 10 digits. */
export function phoneMatchesCountry(country: CountryCode, phone?: string | null): boolean {
    const compact = (phone ?? "").replace(/[\s\-()]/g, "");
    return country === "US" ? /^\+1\d{10}$/.test(compact) : /^\+251\d{9}$/.test(compact);
}

export const phoneMessage = (country: CountryCode) =>
    country === "US" ? "Enter a valid US phone number." : "Enter a valid Ethiopian phone number.";
