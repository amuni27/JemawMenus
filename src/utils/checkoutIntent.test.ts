// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearIntent, intentFor, isStripeCheckoutUrl, readIntent, rememberCheckout, restoreIntent } from "./checkoutIntent";

// AGF F3 (register §84 D5): one Idempotency-Key per intent; only Stripe's hosted checkout is followed.
afterEach(() => { sessionStorage.clear(); vi.restoreAllMocks(); });

describe("checkout intent", () => {
    it("reuses the key for the same price and starts a new intent for another", () => {
        const a = intentFor("p-month", "MODEL_4");
        expect(intentFor("p-month", "MODEL_4").idempotencyKey).toBe(a.idempotencyKey);
        const b = intentFor("p-year", "MODEL_4");
        expect(b.idempotencyKey).not.toBe(a.idempotencyKey);
        expect(readIntent()).toMatchObject({ priceId: "p-year" });
    });

    it("remembers, restores and clears the checkout", () => {
        const a = rememberCheckout(intentFor("p-month", "MODEL_4"), "chk-1");
        intentFor("p-year", "MODEL_4");
        restoreIntent(a);
        expect(readIntent()).toMatchObject({ priceId: "p-month", checkoutId: "chk-1" });
        clearIntent();
        expect(readIntent()).toBeNull();
    });

    it("ignores malformed stored data and survives unavailable storage", () => {
        sessionStorage.setItem("agafari.checkoutIntent", "{not json");
        expect(readIntent()).toBeNull();
        sessionStorage.setItem("agafari.checkoutIntent", JSON.stringify({ priceId: 1 }));
        expect(readIntent()).toBeNull();
        vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
        expect(intentFor("p-month", "MODEL_4").priceId).toBe("p-month");
    });

    it("follows only Stripe's hosted checkout", () => {
        expect(isStripeCheckoutUrl("https://checkout.stripe.com/c/pay/cs_test_1")).toBe(true);
        for (const bad of ["http://checkout.stripe.com/x", "https://checkout.stripe.com.evil.example/x", "https://evil.example/https://checkout.stripe.com/", "javascript:alert(1)", null, 3]) {
            expect(isStripeCheckoutUrl(bad)).toBe(false);
        }
    });
});
