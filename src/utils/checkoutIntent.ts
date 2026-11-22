// AGF F3/F4 (register §84 D5, option R1): this browser's checkout intent, so a retry reuses its Idempotency-Key and the return
// page knows which plan to wait for. Session storage only (never shared across tabs or devices); a failure to store is harmless.

export type CheckoutIntent = { priceId: string; planCode: string; idempotencyKey: string; checkoutId?: string };

const KEY = "agafari.checkoutIntent";

export function readIntent(): CheckoutIntent | null {
    try {
        const raw = sessionStorage.getItem(KEY);
        const v = raw ? JSON.parse(raw) : null;
        return v && typeof v.priceId === "string" && typeof v.planCode === "string" && typeof v.idempotencyKey === "string" ? v : null;
    } catch {
        return null;
    }
}

/** Only Stripe's hosted checkout is ever followed (register §84 D5). */
export const isStripeCheckoutUrl = (url: unknown): url is string => typeof url === "string" && url.startsWith("https://checkout.stripe.com/");

/** Puts back an earlier intent (its checkout is still the one in progress). */
export function restoreIntent(intent: CheckoutIntent): CheckoutIntent {
    return write(intent);
}

function write(intent: CheckoutIntent): CheckoutIntent {
    try {
        sessionStorage.setItem(KEY, JSON.stringify(intent));
    } catch {
        // storage unavailable: the checkout still works; only a retry may get a new key
    }
    return intent;
}

function newKey(): string {
    return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `k-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** The intent for this price: the same one (and key) while it's the same choice, otherwise a new one. */
export function intentFor(priceId: string, planCode: string): CheckoutIntent {
    const current = readIntent();
    if (current && current.priceId === priceId) return current;
    return write({ priceId, planCode, idempotencyKey: newKey() });
}

export function rememberCheckout(intent: CheckoutIntent, checkoutId: string): CheckoutIntent {
    return write({ ...intent, checkoutId });
}

export function clearIntent(): void {
    try {
        sessionStorage.removeItem(KEY);
    } catch {
        // nothing stored
    }
}
