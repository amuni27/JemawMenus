import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import planApi from "../../api/planApi";

// ONB Phase 1 (UX-AC6): on the account page, plans are managed in Subscription & Plans; this only links there, and shows
// nothing while plans aren't visible (a failure hides it without touching the rest of the page).

export default function PlanLink({ plansHref }: { plansHref: string }) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        let alive = true;
        planApi.get().then((res) => alive && setVisible(Boolean(res.data.visible)), () => alive && setVisible(false));
        return () => { alive = false; };
    }, []);

    if (!visible) return null;
    return (
        <section aria-labelledby="account-plan" className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 id="account-plan" className="text-base font-semibold text-gray-900">Plan</h3>
            <p className="mt-2 text-sm text-gray-800">
                Manage your plan in <Link to={plansHref} className="font-medium text-gray-900 underline">Subscription &amp; Plans</Link>.
            </p>
        </section>
    );
}
