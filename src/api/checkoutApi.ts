import apiAuth from "../services/apiAuth.ts";

// AGF F3 (register §84): the owner's Stripe checkouts (backend R5-02 `/api/billing/checkouts`; restaurant from the token).
// A checkout is never a subscription: the plan starts only from the backend's verified payment (P-7).
export type CheckoutStatus = "CREATING" | "OPEN" | "CANCEL_REQUESTED" | "CREATE_FAILED" | "COMPLETED" | "EXPIRED" | "CANCELLED";
export type Checkout = { checkoutId: string; status: CheckoutStatus | string; redirectUrl: string | null; expiresAt?: string; rowVersion?: number };

const checkoutApi = {
    // one Idempotency-Key per owner intent: a retry or double click reuses it, so the backend returns the same checkout
    create(priceId: string, idempotencyKey: string) {
        return apiAuth.post<Checkout>("/billing/checkouts", { priceId }, { headers: { "Idempotency-Key": idempotencyKey } });
    },
    get(checkoutId: string) {
        return apiAuth.get<Checkout>(`/billing/checkouts/${encodeURIComponent(checkoutId)}`);
    },
    cancel(checkoutId: string) {
        return apiAuth.post<Checkout>(`/billing/checkouts/${encodeURIComponent(checkoutId)}/cancel`);
    },
};

export default checkoutApi;
