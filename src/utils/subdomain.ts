// Display form of a stored business subdomain (AGF-S2-10). The backend stores the full host
// (e.g. "abol.agafarimenu.com"); it is shown as stored, never with another domain appended.
export function formatSubdomain(stored?: string | null): string | null {
    if (!stored || !stored.trim()) return null;
    return stored.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "");
}
