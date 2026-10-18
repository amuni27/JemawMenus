// One currency per restaurant (AGF-S2-02). Owners choose ETB or USD (D6); ETB is the default.
export const SUPPORTED_CURRENCIES = ["ETB", "USD"] as const;
export const DEFAULT_CURRENCY = "ETB";

export function displayCurrency(currency?: string | null): string {
    return currency && currency.trim() ? currency.trim() : DEFAULT_CURRENCY;
}

/** "ETB 420.00" — the same format in the admin and guest UIs. */
export function formatPrice(amount: number | string | null | undefined, currency?: string | null): string {
    const value = typeof amount === "number" ? amount : Number(amount ?? 0);
    return `${displayCurrency(currency)} ${(Number.isFinite(value) ? value : 0).toFixed(2)}`;
}
