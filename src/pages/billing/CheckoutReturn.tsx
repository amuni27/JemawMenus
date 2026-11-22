import { useEffect, useState } from "react";
import planApi, { type OwnerPlanView } from "../../api/planApi";
import { clearIntent, readIntent } from "../../utils/checkoutIntent";
import { RETURN_ACTIVE, RETURN_CONFIRMING, RETURN_NOT_YET, RETURN_NO_CHECKOUT, RETURN_REVIEW } from "../../components/plan/planText";
import CheckoutShell from "./CheckoutShell";

// AGF F4 (register §84 D5, P-7): Stripe's success redirect proves nothing. This page ignores the URL's query and waits, every
// 3 s for up to 2 min, until the backend's own plan view (built from verified payment evidence) shows the chosen plan active.
const INTERVAL_MS = 3000;
const WINDOW_MS = 120000;

type State = "confirming" | "active" | "review" | "notYet" | "noCheckout";

function outcome(view: OwnerPlanView, planCode: string): State | null {
    if (view.current?.planCode === planCode && view.current.status === "ACTIVE") return "active";
    if (view.paymentUnderReview) return "review";
    return null;
}

export default function CheckoutReturn() {
    const [intent] = useState(readIntent);
    const [state, setState] = useState<State>(intent?.checkoutId ? "confirming" : "noCheckout");

    useEffect(() => {
        if (!intent?.checkoutId) return;
        let alive = true;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const deadline = Date.now() + WINDOW_MS;
        const poll = async () => {
            let found: State | null = null;
            try {
                found = outcome((await planApi.get()).data, intent.planCode);
            } catch {
                // a failed read is not an answer: keep waiting within the window
            }
            if (!alive) return;
            if (found) {
                if (found === "active") clearIntent();
                setState(found);
            } else if (Date.now() + INTERVAL_MS > deadline) {
                setState("notYet");
            } else {
                timer = setTimeout(poll, INTERVAL_MS);
            }
        };
        void poll();
        return () => {
            alive = false;
            if (timer) clearTimeout(timer);
        };
    }, [intent]);

    switch (state) {
        case "active":
            return <CheckoutShell title={RETURN_ACTIVE} />;
        case "review":
            return <CheckoutShell title={RETURN_REVIEW} />;
        case "notYet":
            return <CheckoutShell title={RETURN_NOT_YET} />;
        case "noCheckout":
            return <CheckoutShell title={RETURN_NO_CHECKOUT} />;
        default:
            return <CheckoutShell title={RETURN_CONFIRMING} busy />;
    }
}
