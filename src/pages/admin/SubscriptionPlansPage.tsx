import { useCallback, useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useAuth } from "../../app/context/AuthContext";
import planApi, { type OwnerGrandfathering, type OwnerPlanView } from "../../api/planApi";
import Modal from "../../components/ui/Modal";
import ModalHeader from "../../components/ui/ModalHeader";
import { errorMessage } from "../../utils/errorMessage";
import { trialEndDate } from "../../utils/trialDate";
import {
    ACTIVATION_NOTE, CHANGE_NOTE, FEATURES_NOTE, OWNER_PRIMARY, OWNER_SECONDARY, PLAN_BENEFITS, PLAN_COMPARISON, PLAN_DESCRIPTIONS, PRICING_NOTE,
    TRIAL_DAYS, TRIAL_NOTICE_DAYS, TRIAL_REFUSALS, TRIAL_TERMS, days, planName, statusLabel,
} from "../../components/plan/planText";

// ONB Phase 1: the owner's Subscription & Plans page (moved from the account page's Plan section, AGF E4-M4). Only while
// the backend says plans are visible. Current plan and status with the existing trial, grandfathering, ended-plan and
// pending-request notices; under Setting 2 one card per enabled plan (approved names and benefits) and a comparison; a
// request is never a subscription and there is no change action (E4-M4-Q4). No prices; every feature stays available.
// AGF Self-Service Phase A: while self-service is on, a free plan shows "Start free" (approved wording, SS-9); a pending
// request is withdrawn only after the owner confirms it in the dialog (SS-3); paid plans keep "Request".
// AGF FE-1 (register §45 D-3, §46, §47): under Setting 1, while the backend says the restaurant is eligible (trialEligible),
// the owner starts the free trial after a confirmation. While email verification is required (operational and not yet
// verified, Q2) the page asks for it instead of offering the start. Every outcome reloads the view.

type Dialog = { kind: "request"; planCode: string } | { kind: "withdraw" } | { kind: "start"; planCode: string } | { kind: "trial" } | null;
type ApiRefusal = { response?: { data?: { code?: unknown } } };

export default function SubscriptionPlansPage() {
    const { tenantSlug } = useParams();
    const [view, setView] = useState<OwnerPlanView | null>(null);
    const [dialog, setDialog] = useState<Dialog>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const { user, refresh } = useAuth();

    const load = useCallback(() => planApi.get().then((res) => setView(res.data), () => setView({ visible: false })), []);
    useEffect(() => { load(); }, [load]);

    if (!view) return <p className="text-sm text-gray-700">Loading…</p>;
    if (!view.visible) return <Navigate to={`/${tenantSlug}/admin`} replace />;

    const run = async (action: () => Promise<unknown>) => {
        setBusy(true);
        setError("");
        setNotice("");
        try {
            await action();
        } catch (err) {
            setError(errorMessage(err, "Couldn't send your request. Please try again."));
        } finally {
            setDialog(null);
            setBusy(false);
            await load();
        }
    };

    const pending = view.pendingRequest;
    const current = view.current;
    const trial = view.trial;
    const setting2 = view.setting === "SETTING_2";
    const plans = view.plans ?? [];
    const canRequest = Boolean(view.canRequest) && !current && !pending;
    const selfService = view.selfService;
    const canStartFree = Boolean(selfService?.available) && !current;
    const setting1 = view.setting === "SETTING_1";
    const trialOffered = setting1 && view.trialEligible === true && !current && !trial;
    const verification = user?.emailVerification;
    const mustVerify = Boolean(verification?.available && !verification.verified); // Q2: only while verification is operational

    const startTrial = async () => {
        if (busy) return;
        setBusy(true);
        setError("");
        setNotice("");
        try {
            const res = await planApi.startTrial(view.configVersion ?? 0);
            setNotice(res.data.created ? "Your free trial has started." : "Your free trial is already running.");
        } catch (err) {
            const code = (err as ApiRefusal | null)?.response?.data?.code;
            const known = typeof code === "string" ? TRIAL_REFUSALS[code] : undefined;
            setError(known ?? errorMessage(err, "Couldn't start your free trial. Please try again."));
            if (code === "EMAIL_NOT_VERIFIED") await refresh?.(); // the session's verification state was out of date
        } finally {
            setDialog(null);
            setBusy(false);
            await load();
        }
    };

    return (
        <section id="plan" aria-labelledby="plans-heading" className="space-y-6">
            <div>
                {/* the owner layout already has the page h1; owner pages title themselves with h2 (as Account & Settings) */}
                <h2 id="plans-heading" className="text-2xl font-bold text-gray-900">Subscription &amp; Plans</h2>
                <p className="mt-1 text-sm text-gray-700">{setting2 ? "Compare the plans available for your restaurant." : "Your restaurant's plan."}</p>
            </div>
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            {notice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}

            <section aria-labelledby="current-plan" className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
                <h3 id="current-plan" className="text-base font-semibold text-gray-900">Current plan</h3>

                {current && (
                    <div className="mt-3 text-sm text-gray-800">
                        <p className="font-semibold">{planName(current.planCode)} · {statusLabel(current.status)}</p>
                        <p className="text-gray-700">{PLAN_DESCRIPTIONS[current.planCode]}</p>
                        {current.sourceLabel && <p className="mt-1 text-xs text-gray-700">{current.sourceLabel}</p>}
                        {current.periodEnd && <p className="mt-1 text-gray-700">Current period ends {new Date(current.periodEnd).toLocaleDateString()}</p>}
                        {current.outsideCurrentConfiguration && !current.grandfathering && <p className="mt-1 text-gray-700">Your plan stays as it is for now.</p>}
                        {current.grandfathering && <GrandfatheringNotice planCode={current.planCode} g={current.grandfathering} setting1={view.setting === "SETTING_1"} />}
                        <p className="mt-3 text-gray-700">{CHANGE_NOTE}</p>
                    </div>
                )}

                {!current && view.endedPlan && (
                    <p className="mt-3 text-sm font-semibold text-gray-800">
                        Your previous plan ({planName(view.endedPlan.planCode)}) ended on {trialEndDate(view.endedPlan.endedAt, view.endedPlan.timeZone)}.{" "}
                        {view.setting === "SETTING_1" ? "Contact the Agafari team to continue with Model 1." : "Choose a plan to continue."}
                    </p>
                )}

                {!current && trial && trial.effectiveStatus === "TRIAL" && (
                    <div className="mt-3 text-sm text-gray-800">
                        <p className="font-semibold">Free trial: {days(trial.daysLeft)} left (ends {trialEndDate(trial.endsAt, trial.timeZone)}).</p>
                        {trial.daysLeft <= TRIAL_NOTICE_DAYS && (
                            <p role="status" className="mt-2 rounded-lg bg-amber-50 p-3 text-amber-900">
                                Your free trial ends in {days(trial.daysLeft)}. The Agafari team will contact you about your plan.
                            </p>
                        )}
                    </div>
                )}

                {!current && trial && trial.effectiveStatus === "EXPIRED" && (
                    <div className="mt-3 text-sm text-gray-800">
                        <p className="font-semibold">Your free trial ended on {trialEndDate(trial.endsAt, trial.timeZone)}.</p>
                        <p className="mt-1">All features stay available for now. The Agafari team will contact you.</p>
                    </div>
                )}

                {!current && !trial && setting1 && !trialOffered && (
                    <div className="mt-3 text-sm text-gray-800">
                        <p>Your plan model: free trial, then a paid subscription.</p>
                        <p className="mt-1 text-gray-700">Trial details aren't available yet.</p>
                    </div>
                )}

                {trialOffered && (
                    <section aria-labelledby="free-trial" className="mt-3 text-sm text-gray-800">
                        <h4 id="free-trial" className="font-semibold text-gray-900">Free trial</h4>
                        <ul className="mt-2 space-y-1">
                            {TRIAL_TERMS.map((t) => (
                                <li key={t} className="flex gap-2"><span aria-hidden="true" className="text-emerald-700">✓</span><span>{t}</span></li>
                            ))}
                        </ul>
                        {mustVerify ? (
                            <p className="mt-3 rounded-lg bg-amber-50 p-3 text-amber-900">
                                Verify your email to start your free trial. We sent a link to {user?.email}. Use Resend link at the top of the page if you need a new one.
                            </p>
                        ) : (
                            <button type="button" className={`${OWNER_PRIMARY} mt-4`} onClick={() => setDialog({ kind: "trial" })} disabled={busy}>
                                Start free trial
                            </button>
                        )}
                    </section>
                )}

                {!current && pending && (
                    <div className="mt-3 text-sm text-gray-800">
                        <p>Request for {planName(pending.planCode)} sent on {new Date(pending.requestedAt).toLocaleDateString()}. The Agafari team will contact you.</p>
                        <button type="button" className={`${OWNER_SECONDARY} mt-3`} onClick={() => setDialog({ kind: "withdraw" })} disabled={busy}>
                            Withdraw request
                        </button>
                    </div>
                )}

                {!current && !pending && !trial && !view.endedPlan && setting2 && (
                    <p className="mt-3 text-sm text-gray-800">You don't have a plan yet. Choose one below.</p>
                )}
            </section>

            {setting2 && plans.length > 0 && (
                <section aria-labelledby="available-plans" className="space-y-4">
                    <h3 id="available-plans" className="text-base font-semibold text-gray-900">Available plans</h3>
                    {pending && <p className="text-sm text-gray-700">You have a pending request. Withdraw it to request another plan.</p>}
                    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {plans.map((p) => {
                            const isCurrent = current?.planCode === p.code;
                            const isRequested = !current && pending?.planCode === p.code;
                            return (
                                <li key={p.code} className="flex">
                                    <article aria-labelledby={`plan-${p.code}`}
                                             className={`flex w-full flex-col rounded-2xl border bg-white p-5 shadow-sm ${isCurrent || isRequested ? "border-gray-900 ring-1 ring-gray-900" : "border-gray-200"}`}>
                                        <div className="flex items-start justify-between gap-2">
                                            <h4 id={`plan-${p.code}`} className="text-lg font-semibold text-gray-900">{planName(p.code)}</h4>
                                            {isCurrent && <span className="rounded-full bg-gray-900 px-2.5 py-0.5 text-xs font-semibold text-white">Current plan</span>}
                                            {isRequested && <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900">Requested</span>}
                                        </div>
                                        <ul className="mt-3 flex-1 space-y-2 text-sm text-gray-800">
                                            {(PLAN_BENEFITS[p.code] ?? [PLAN_DESCRIPTIONS[p.code]]).map((b) => (
                                                <li key={b} className="flex gap-2"><span aria-hidden="true" className="text-emerald-700">✓</span><span>{b}</span></li>
                                            ))}
                                        </ul>
                                        {!p.paid && canStartFree ? (
                                            <div className="mt-4">
                                                {pending && (
                                                    <p className="mb-2 text-sm text-gray-800">
                                                        You have a pending request for {planName(pending.planCode)}. Starting {planName(p.code)} will withdraw it.
                                                    </p>
                                                )}
                                                {selfService?.verificationRequired && <p className="mb-2 text-sm text-gray-800">Verify your email to start {planName(p.code)}.</p>}
                                                <button type="button" className={`${OWNER_PRIMARY} w-full`} onClick={() => setDialog({ kind: "start", planCode: p.code })}
                                                        disabled={busy || selfService?.verificationRequired}>
                                                    Start free
                                                </button>
                                            </div>
                                        ) : canRequest && (p.paid || !selfService) && (
                                            <button type="button" className={`${OWNER_PRIMARY} mt-4 w-full`} onClick={() => setDialog({ kind: "request", planCode: p.code })}
                                                    disabled={busy}>
                                                Request {planName(p.code)}
                                            </button>
                                        )}
                                    </article>
                                </li>
                            );
                        })}
                    </ul>

                    <div className="hidden overflow-x-auto rounded-2xl border border-gray-200 bg-white p-4 shadow-sm md:block">
                        <table aria-label="Plan comparison" className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b text-gray-700">
                                    <th scope="col" className="py-2 pr-4 font-semibold"><span className="sr-only">Feature</span></th>
                                    {plans.map((p) => <th key={p.code} scope="col" className="py-2 pr-4 font-semibold text-gray-900">{planName(p.code)}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {PLAN_COMPARISON.map((row) => (
                                    <tr key={row.label} className="border-b last:border-0">
                                        <th scope="row" className="py-2 pr-4 font-medium text-gray-700">{row.label}</th>
                                        {plans.map((p) => <td key={p.code} className="py-2 pr-4 text-gray-900">{row.values[p.code] ?? "—"}</td>)}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            <div className="space-y-1 text-xs text-gray-700">
                {setting2 && <p>{PRICING_NOTE}</p>}
                {setting2 && <p>{ACTIVATION_NOTE}</p>}
                <p>{FEATURES_NOTE}</p>
            </div>

            <Modal open={dialog?.kind === "request"} onClose={() => !busy && setDialog(null)} className="max-w-md">
                <div role="dialog" aria-modal="true" aria-label="Request a plan">
                    <ModalHeader title="Request a plan" onClose={() => !busy && setDialog(null)} />
                    <p className="text-sm text-gray-800">{dialog?.kind === "request" ? `${planName(dialog.planCode)}: ${PLAN_DESCRIPTIONS[dialog.planCode]}` : ""}</p>
                    <p className="mt-3 text-sm text-gray-800">This is a request, not a purchase. The Agafari team will contact you.</p>
                    <div className="mt-6 flex justify-end gap-2">
                        <button type="button" className={OWNER_SECONDARY} onClick={() => setDialog(null)} disabled={busy}>Cancel</button>
                        <button type="button" className={OWNER_PRIMARY} disabled={busy}
                                onClick={() => dialog?.kind === "request" && run(() => planApi.request(dialog.planCode, view.configVersion ?? 0))}>
                            {busy ? "Sending…" : "Send request"}
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal open={dialog?.kind === "start"} onClose={() => !busy && setDialog(null)} className="max-w-md">
                {dialog?.kind === "start" && (pending ? (
                    <div role="dialog" aria-modal="true" aria-label={`Start ${planName(dialog.planCode)} and withdraw your request for ${planName(pending.planCode)}?`}>
                        <ModalHeader title={`Start ${planName(dialog.planCode)} and withdraw your request for ${planName(pending.planCode)}?`} onClose={() => !busy && setDialog(null)} />
                        <p className="text-sm text-gray-800">
                            Your request for {planName(pending.planCode)} will be withdrawn. Agafari will show one sponsored item on your guest menu. There's no charge.
                        </p>
                        <div className="mt-6 flex justify-end gap-2">
                            {/* the safe choice has the initial focus (SS-3) */}
                            <button type="button" className={OWNER_SECONDARY} onClick={() => setDialog(null)} disabled={busy} autoFocus>Keep my request</button>
                            <button type="button" className={OWNER_PRIMARY} disabled={busy}
                                    onClick={() => run(() => planApi.activate(dialog.planCode, view.configVersion ?? 0, { id: pending.id, rowVersion: pending.rowVersion }))}>
                                {busy ? "Starting…" : "Withdraw request and start free"}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div role="dialog" aria-modal="true" aria-label={`Start ${planName(dialog.planCode)}?`}>
                        <ModalHeader title={`Start ${planName(dialog.planCode)}?`} onClose={() => !busy && setDialog(null)} />
                        <p className="text-sm text-gray-800">Agafari will show one sponsored item on your guest menu. There's no charge.</p>
                        <p className="mt-2 text-sm text-gray-800">To change your plan later, contact the Agafari team.</p>
                        <div className="mt-6 flex justify-end gap-2">
                            <button type="button" className={OWNER_SECONDARY} onClick={() => setDialog(null)} disabled={busy}>Cancel</button>
                            <button type="button" className={OWNER_PRIMARY} disabled={busy} onClick={() => run(() => planApi.activate(dialog.planCode, view.configVersion ?? 0, undefined))}>
                                {busy ? "Starting…" : "Start free"}
                            </button>
                        </div>
                    </div>
                ))}
            </Modal>

            <Modal open={dialog?.kind === "trial"} onClose={() => !busy && setDialog(null)} className="max-w-md">
                <div role="dialog" aria-modal="true" aria-label={`Start your ${TRIAL_DAYS}-day free trial?`}>
                    <ModalHeader title={`Start your ${TRIAL_DAYS}-day free trial?`} onClose={() => !busy && setDialog(null)} />
                    <p className="text-sm text-gray-800">Your free trial lasts {TRIAL_DAYS} days. There's no charge and no payment details are needed.</p>
                    <p className="mt-2 text-sm text-gray-800">Each restaurant can have one free trial. Before it ends, the Agafari team will contact you about your plan.</p>
                    <div className="mt-6 flex justify-end gap-2">
                        <button type="button" className={OWNER_SECONDARY} onClick={() => setDialog(null)} disabled={busy}>Cancel</button>
                        <button type="button" className={OWNER_PRIMARY} disabled={busy} onClick={startTrial}>
                            {busy ? "Starting…" : "Start free trial"}
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal open={dialog?.kind === "withdraw"} onClose={() => !busy && setDialog(null)} className="max-w-md">
                <div role="dialog" aria-modal="true" aria-label="Withdraw request">
                    <ModalHeader title="Withdraw request" onClose={() => !busy && setDialog(null)} />
                    <p className="text-sm text-gray-800">Withdraw your request for {pending ? planName(pending.planCode) : ""}?</p>
                    <div className="mt-6 flex justify-end gap-2">
                        <button type="button" className={OWNER_SECONDARY} onClick={() => setDialog(null)} disabled={busy}>Cancel</button>
                        <button type="button" className={OWNER_PRIMARY} disabled={busy} onClick={() => pending && run(() => planApi.withdraw(pending.rowVersion))}>
                            {busy ? "Withdrawing…" : "Withdraw"}
                        </button>
                    </div>
                </div>
            </Modal>
        </section>
    );
}

// AGF E4-M6 (Q7): grandfathering notices. No promise of outreach or emails; the last-week warning only when transitions are
// on (only then does the plan actually end).
function GrandfatheringNotice({ planCode, g, setting1 }: { planCode: string; g: OwnerGrandfathering; setting1: boolean }) {
    const plan = `Your plan (${planName(planCode)})`;
    const end = g.until ? trialEndDate(g.until, g.timeZone) : null;
    return (
        <div className="mt-2">
            <p className="text-gray-800">{plan} is no longer offered. {end ? `It stays active until ${end}.` : "It stays active for now."}</p>
            {end && g.transitionsEnabled && g.daysLeft !== undefined && g.daysLeft <= TRIAL_NOTICE_DAYS && (
                <p role="status" className="mt-2 rounded-lg bg-amber-50 p-3 text-amber-900">
                    {plan} ends in {days(g.daysLeft)}, on {end}. {setting1 ? "After that, contact the Agafari team to continue." : "After that you can choose one of the available plans."}
                </p>
            )}
        </div>
    );
}
