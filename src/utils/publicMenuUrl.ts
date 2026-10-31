// AGF-S2-20 / D2: the guest menu address is configuration, never a hard-coded brand domain.
// VITE_PUBLIC_MENU_BASE_URL (build-time, like VITE_API_BASE_URL) sets the base; it is validated and normalised here,
// in one place, for every QR code, print layout and guest link. Changing the domain = change the variable and rebuild.

/** Used only when the variable is unset or empty: the production frontend every QR code printed so far points to. */
export const FALLBACK_PUBLIC_MENU_BASE = "https://agafari-menu.onrender.com";

export type PublicMenuBase = { ok: true; base: string } | { ok: false; reason: string };

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function isLocalHost(hostname: string): boolean {
    return LOCAL_HOSTS.has(hostname) || hostname.endsWith(".localhost");
}

/**
 * Validates and normalises a configured base URL. Accepted: absolute https URLs (http only for localhost,
 * 127.0.0.1, [::1] and *.localhost) without credentials, query, fragment or whitespace. The host is lower-cased,
 * the default port dropped and trailing slashes removed; an optional path prefix is kept.
 */
export function normalizePublicMenuBase(raw: string | undefined): PublicMenuBase {
    const value = (raw ?? "").trim();
    if (value === "") return { ok: true, base: FALLBACK_PUBLIC_MENU_BASE };

    if (/\s/.test(value)) return { ok: false, reason: "contains whitespace" };
    if (!/^https?:\/\//i.test(value)) return { ok: false, reason: "must start with https://" };
    if (/[?#]/.test(value)) return { ok: false, reason: "must not contain a query or fragment" };

    let url: URL;
    try {
        url = new URL(value);
    } catch {
        return { ok: false, reason: "is not a valid URL" };
    }
    if (!url.hostname) return { ok: false, reason: "has no host" };
    if (url.username || url.password) return { ok: false, reason: "must not contain credentials" };
    if (url.protocol === "http:" && !isLocalHost(url.hostname)) {
        return { ok: false, reason: "must use https outside local development" };
    }

    const path = url.pathname.replace(/\/+$/, "");
    return { ok: true, base: `${url.protocol}//${url.host}${path}` };
}

/** The configured guest menu base URL (or why it is unusable). */
export function publicMenuBase(): PublicMenuBase {
    return normalizePublicMenuBase(import.meta.env.VITE_PUBLIC_MENU_BASE_URL);
}

/** `{base}/{businessId}/menu`, the URL format existing QR codes use; null when the configured base is invalid. */
export function publicMenuUrl(businessId: string | undefined): string | null {
    if (!businessId) {
        throw new Error("businessId is required to build the guest menu URL");
    }
    const config = publicMenuBase();
    return config.ok ? `${config.base}/${encodeURIComponent(businessId)}/menu` : null;
}
