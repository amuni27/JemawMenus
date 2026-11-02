import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import planApi, { type OwnerPlanView } from "../../api/planApi";
import { FEATURES_NOTE, days, planName, statusLabel } from "./planText";

// AGF E4-M4: dashboard summary of the owner's plan, linking to Subscription & Plans (ONB Phase 1; summary only, the
// controls live there). Hidden unless the backend says plans are visible; a failure hides it without touching the rest of
// the dashboard.

export default function PlanCard({ plansHref }: { plansHref: string }) {
    const [view, setView] = useState<OwnerPlanView | null>(null);

    useEffect(() => {
        let alive = true;
        planApi.get().then((res) => alive && setView(res.data), () => alive && setView({ visible: false }));
        return () => { alive = false; };
    }, []);

    if (!view?.visible) return null;

    const summary = view.current ? `${planName(view.current.planCode)} · ${statusLabel(view.current.status)}`
        : view.pendingRequest ? `Request for ${planName(view.pendingRequest.planCode)} pending`
        : view.trial ? (view.trial.effectiveStatus === "TRIAL" ? `Free trial: ${days(view.trial.daysLeft)} left` : "Free trial ended")
        : view.setting === "SETTING_1" ? "Free trial, then a paid subscription"
        : "Choose a plan for your restaurant";

    return (
        <section role="region" aria-labelledby="dash-plan" className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <h3 id="dash-plan" className="text-sm font-semibold text-gray-700">Plan</h3>
            <p className="mt-2 text-sm font-medium text-gray-900">{summary}</p>
            <p className="mt-1 text-xs text-gray-700">{FEATURES_NOTE}</p>
            <Link to={plansHref} className="mt-3 inline-block text-sm font-medium text-gray-900 underline">View plans</Link>
        </section>
    );
}
