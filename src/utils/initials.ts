/** Up to two initials for the logo fallback badge (AGF-S2-01): "Abol Demo Café" → "AD". */
export function businessInitials(name?: string | null): string {
    const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return "?";
    return words.slice(0, 2).map((w) => Array.from(w)[0]).join("").toUpperCase();
}
