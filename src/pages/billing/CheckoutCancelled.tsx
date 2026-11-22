import { useEffect, useState } from "react";
import checkoutApi from "../../api/checkoutApi";
import { clearIntent, readIntent } from "../../utils/checkoutIntent";
import { CANCEL_ALREADY_FINISHED, CHECKOUT_CANCELLED_NOTICE, RETURN_NO_CHECKOUT } from "../../components/plan/planText";
import CheckoutShell from "./CheckoutShell";

// AGF F4 (register §84 D5): Stripe's cancel redirect. Asks the backend to cancel this browser's checkout so a new one can start;
// if that request fails, the checkout is kept so "Cancel it" on Subscription & Plans (D7) can finish the job.
type State = "cancelling" | "cancelled" | "finished" | "noCheckout";

const codeOf = (e: unknown) => (e as { response?: { status?: number; data?: { code?: string } } })?.response;

export default function CheckoutCancelled() {
    const [intent] = useState(readIntent);
    const [state, setState] = useState<State>(intent?.checkoutId ? "cancelling" : "noCheckout");

    useEffect(() => {
        const checkoutId = intent?.checkoutId;
        if (!checkoutId) return;
        let alive = true;
        checkoutApi.cancel(checkoutId).then(
            () => {
                clearIntent();
                if (alive) setState("cancelled");
            },
            (e) => {
                const r = codeOf(e);
                if (r?.status === 409 && r.data?.code === "CHECKOUT_NOT_CANCELLABLE") {
                    clearIntent();
                    if (alive) setState("finished");
                    return;
                }
                if ((r?.status === 409 && r.data?.code === "CHECKOUT_CANCELLED") || r?.status === 404) clearIntent();
                if (alive) setState("cancelled");
            },
        );
        return () => { alive = false; };
    }, [intent]);

    if (state === "noCheckout") return <CheckoutShell title={RETURN_NO_CHECKOUT} />;
    if (state === "finished") return <CheckoutShell title={CANCEL_ALREADY_FINISHED} />;
    if (state === "cancelled") return <CheckoutShell title={CHECKOUT_CANCELLED_NOTICE} />;
    return <CheckoutShell title="Cancelling…" busy />;
}
