// Stored session and session-end signalling (AGF-S1-11).
// The axios interceptor only clears storage and announces what happened; route guards decide where to go,
// so public guest pages are never redirected to login.

export const TOKEN_KEY = "token";
export const SESSION_KEY = "session";

export const SESSION_ENDED_EVENT = "agafari:session-ended";
export const ACCESS_DENIED_EVENT = "agafari:access-denied";

export const ACCESS_DENIED_MESSAGE = "You don't have access to this resource";

export type SessionEndReason = "expired" | "inactive";

export function clearStoredSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(SESSION_KEY);
}

/** Replaces the stored token (and the token inside the stored session, if any). */
export function storeToken(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return;
    try {
        localStorage.setItem(SESSION_KEY, JSON.stringify({ ...JSON.parse(raw), token }));
    } catch {
        localStorage.removeItem(SESSION_KEY);
    }
}

export function announceSessionEnded(reason: SessionEndReason) {
    window.dispatchEvent(new CustomEvent(SESSION_ENDED_EVENT, { detail: { reason } }));
}

export function announceAccessDenied() {
    window.dispatchEvent(new CustomEvent(ACCESS_DENIED_EVENT, { detail: { message: ACCESS_DENIED_MESSAGE } }));
}

/** Login URL that explains why the session ended and remembers where to return. */
export function loginPath(reason?: SessionEndReason | null, next?: string) {
    const params = new URLSearchParams();
    if (reason) params.set("reason", reason);
    if (next) params.set("next", next);
    const query = params.toString();
    return query ? `/auth/login?${query}` : "/auth/login";
}

/** Only the signed-in restaurant's own admin pages are accepted as a return path (no open redirects). */
export function safeNextPath(next: string | null, businessId?: string): string | null {
    if (!next || !businessId) return null;
    if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return null;
    const prefix = `/${businessId}/admin`;
    return next === prefix || next.startsWith(`${prefix}/`) ? next : null;
}
