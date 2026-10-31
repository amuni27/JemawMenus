// AGF-S2-12: restaurant location links. The same rules as the backend (GoogleMapsUrls.java), which stays authoritative;
// these give immediate messages only. Exact https hosts with their path rules, no user-info, no non-default port,
// at most 2,048 characters (D-REV-4). Links are only parsed, never fetched.

export const GOOGLE_MAPS_URL_MESSAGE =
    "Use a Google Maps share link (https://maps.app.goo.gl/… or https://www.google.com/maps/…).";
export const GOOGLE_MAPS_FIND_URL = "https://www.google.com/maps";
const MAX_LENGTH = 2048;

function pathAllowed(host: string, path: string): boolean {
    switch (host) {
        case "www.google.com":
        case "google.com":
            return path === "/maps" || path.startsWith("/maps/");
        case "maps.google.com":
            return true;
        case "maps.app.goo.gl":
            return path.length > 1;
        case "goo.gl":
            return path.startsWith("/maps/") && path.length > "/maps/".length;
        default:
            return false;
    }
}

export function isGoogleMapsUrl(raw: string | null | undefined): boolean {
    const value = (raw ?? "").trim();
    if (!value || value.length > MAX_LENGTH || /[\s\p{Cc}]/u.test(value)) return false;
    if (!/^https:\/\//i.test(value)) return false;
    let url: URL;
    try {
        url = new URL(value);
    } catch {
        return false;
    }
    if (url.protocol !== "https:" || url.username || url.password || url.port !== "") return false;
    return pathAllowed(url.hostname.toLowerCase(), url.pathname);
}

/** The message for an invalid link; null when the field is empty (optional) or valid. */
export function googleMapsUrlProblem(raw: string | null | undefined): string | null {
    if (!(raw ?? "").trim()) return null;
    return isGoogleMapsUrl(raw) ? null : GOOGLE_MAPS_URL_MESSAGE;
}
