import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useAuth } from "../../app/context/AuthContext";
import planApi, { type OwnerGrandfathering, type OwnerPlanView, type OwnerRenewal } from "../../api/planApi";
import Modal from "../../components/ui/Modal";
import NoticeList from "../../components/plan/NoticeList";
import checkoutApi, { type Checkout } from "../../api/checkoutApi";
import { clearIntent, intentFor, isStripeCheckoutUrl, readIntent, rememberCheckout, restoreIntent } from "../../utils/checkoutIntent";
import ModalHeader from "../../components/ui/ModalHeader";
import { errorMessage } from "../../utils/errorMessage";
import { trialEndDate } from "../../utils/trialDate";
import {
    ACTIVATION_NOTE, CHANGE_NOTE, FEATURES_NOTE, OWNER_PRIMARY, OWNER_SECONDARY, PLAN_BENEFITS, PLAN_COMPARISON, PLAN_DESCRIPTIONS,
    TRIAL_DAYS, TRIAL_NOTICE_DAYS, TRIAL_REFUSALS, TRIAL_TERMS, days, planName, statusLabel, CARD_UPDATE_REFUSALS, CARD_UPDATE_FAILED, money,
    PRICE_NOT_AVAILABLE, PAYMENT_NOT_AVAILABLE, priceLine, CHECKOUT_NOTE, CHECKOUT_FAILED, CHECKOUT_NOT_AVAILABLE, CHECKOUT_VERIFY, CHECKOUT_IN_PROGRESS, CHECKOUT_CANCELLED_NOTICE,
    CHECKOUT_REFUSALS,
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
// AGF F2 (register §84 D1): paid cards show the backend's listed prices (amount, currency, interval; no tax wording, AD-16).
// AGF F3 (register §84 D3, D4, D7): "Subscribe" replaces "Request" on a paid card only while the backend says checkout is
// available and lists the plan's price, for an owner without a plan or on the free plan. It starts a checkout with one
// Idempotency-Key per intent and goes only to Stripe's hosted page; the plan starts only from the backend's verified payment.
// AGF FE-R1 (backend R5-03-B/E; addendum §13): a paid plan's renewal state above the current plan (past due with the date to
// update the card by, ended for non-payment, a refund in progress, a payment under review) and "Update card", which opens the
// payment provider's hosted page for the owner's own plan (Agafari never sees card data). Dates in the restaurant's time zone.

type Dialog = { kind: "request"; planCode: string } | { kind: "withdraw" } | { kind: "start"; planCode: string } | { kind: "trial" } | null;
type ApiRefusal = { response?: { data?: { code?: unknown } } };

export default function SubscriptionPlansPage() {
    const { tenantSlug } = useParams();
    const [view, setView] = useState<OwnerPlanView | null>(null);
    const [dialog, setDialog] = useState<Dialog>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [period, setPeriod] = useState<Record<string, string>>({}); // AGF F3: the chosen price per paid plan
    const [inProgress, setInProgress] = useState<{ checkoutId?: string } | null>(null); // AGF F3 (D7)
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
    // AGF F2: prices only as the backend lists them (prices-visible); none for a free plan
    const prices = view.prices ?? [];
    const pricesOf = (code: string) => prices.filter((pr) => pr.planCode === code).sort((a, b) => (a.interval === b.interval ? 0 : a.interval === "MONTH" ? -1 : 1));
    // AGF F3 (D3): the server's NEW and UPGRADE paths: no current plan, or a free one
    const onFreePlan = Boolean(current) && plans.some((p) => p.code === current?.planCode && !p.paid);
    const mayChoosePaid = !current || onFreePlan;
    const canSubscribe = (code: string) => view.checkoutAvailable === true && pricesOf(code).length > 0 && mayChoosePaid;
    const mustVerifyToPay = Boolean(user?.emailVerification?.available && !user?.emailVerification?.verified); // D4 guidance; the backend decides
    const anySubscribe = plans.some((p) => p.paid && canSubscribe(p.code));
    const canRequest = Boolean(view.canRequest) && !current && !pending;
    const selfService = view.selfService;
    // AGF F5 (register §87): only the free plan can still be requested here (self-service off); paid plans never are
    const canRequestFree = (code: string) => canRequest && !selfService && plans.some((p) => p.code === code && !p.paid);
    const anyFreeRequest = plans.some((p) => canRequestFree(p.code));
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

    // AGF FE-R1: the provider's hosted card-update page; only an https link is ever followed
    const updateCard = async () => {
        if (busy) return;
        setBusy(true);
        setError("");
        setNotice("");
        try {
            const res = await planApi.openCardUpdate();
            const url = res.data?.url;
            if (typeof url !== "string" || !url.startsWith("https://")) {
                setError(CARD_UPDATE_FAILED);
                return;
            }
            window.location.assign(url);
        } catch (err) {
            const code = (err as ApiRefusal | null)?.response?.data?.code;
            setError((typeof code === "string" ? CARD_UPDATE_REFUSALS[code] : undefined) ?? CARD_UPDATE_FAILED);
        } finally {
            setBusy(false);
        }
    };

    // AGF F3: start (or resume) the checkout for one price and go to Stripe's page; nothing is activated here
    const goToStripe = (checkout: Checkout): boolean => {
        if (checkout.status === "OPEN" && isStripeCheckoutUrl(checkout.redirectUrl)) {
            window.location.assign(checkout.redirectUrl);
            return true;
        }
        return false;
    };

    const subscribe = async (planCode: string, priceId: string) => {
        if (busy) return;
        setBusy(true);
        setError("");
        setNotice("");
        setInProgress(null);
        const before = readIntent(); // a checkout this browser already started, if any
        const intent = intentFor(priceId, planCode);
        try {
            const res = await checkoutApi.create(priceId, intent.idempotencyKey);
            let checkout = res.data;
            if (checkout?.checkoutId) rememberCheckout(intent, checkout.checkoutId);
            for (let i = 0; checkout?.status === "CREATING" && i < 10; i++) { // 202: the provider session is still being created
                await new Promise((r) => setTimeout(r, 2000));
                checkout = (await checkoutApi.get(checkout.checkoutId)).data;
            }
            if (!checkout || !goToStripe(checkout)) setError(checkout?.status === "CREATING" ? "Your payment page is still being prepared. Please try again in a moment." : CHECKOUT_FAILED);
        } catch (err) {
            const response = (err as { response?: { status?: number; data?: { code?: unknown } } } | null)?.response;
            const code = typeof response?.data?.code === "string" ? response.data.code : undefined;
            if (code === "CHECKOUT_ACTIVE") {
                // D7: the payment in progress is the one this browser started earlier (if any); keep pointing at it
                if (before?.checkoutId) restoreIntent(before);
                setInProgress({ checkoutId: before?.checkoutId ?? readIntent()?.checkoutId });
            } else {
                if (code === "CHECKOUT_CANCELLED" || code === "IDEMPOTENCY_KEY_REUSED") clearIntent();
                setError((code ? CHECKOUT_REFUSALS[code] : undefined) ?? (response?.status === 404 ? CHECKOUT_NOT_AVAILABLE : CHECKOUT_FAILED));
            }
        } finally {
            setBusy(false);
        }
    };

    // AGF F3 (D7): continue or cancel the payment this browser started
    const continuePayment = async (checkoutId: string) => {
        setBusy(true);
        setError("");
        try {
            const checkout = (await checkoutApi.get(checkoutId)).data;
            if (!goToStripe(checkout)) {
                clearIntent();
                setInProgress(null);
                setError(CHECKOUT_FAILED);
                await load();
            }
        } catch {
            setError(CHECKOUT_FAILED);
        } finally {
            setBusy(false);
        }
    };

    const cancelPayment = async (checkoutId: string) => {
        setBusy(true);
        setError("");
        try {
            await checkoutApi.cancel(checkoutId);
            clearIntent();
            setInProgress(null);
            setNotice(CHECKOUT_CANCELLED_NOTICE);
            await load();
        } catch {
            setError(CHECKOUT_FAILED);
        } finally {
            setBusy(false);
        }
    };

    return (
        <section id="plan" aria-labelledby="plans-heading" className="space-y-6">
            <div>
                {/* the owner layout already has the page h1; owner pages title themselves with h2 (as Account & Settings) */}
                <h2 id="plans-heading" className="text-2xl font-bold text-gray-900">Subscription &amp; Plans</h2>
                <p className="mt-1 text-sm text-gray-700">{setting2 ? "Compare the plans available for your restaurant." : "Your restaurant's plan."}</p>
            </div>
            {/* AGF FE-2 (§49 Q8 skippable): first-time banner while the backend says this new restaurant must still choose */}
            {view.selectionRequired === true && (
                <section aria-labelledby="plan-welcome" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-950 sm:p-6">
                    <h3 id="plan-welcome" className="text-base font-semibold">{"Choose how you'd like to start"}</h3>
                    <p className="mt-1">Choose a plan for your restaurant on this page. You can prepare your menus meanwhile.</p>
                    <Link to={`/${tenantSlug}/admin/menus`} className="mt-3 inline-block font-semibold text-rose-700 underline hover:text-rose-800">
                        Continue to my menus
                    </Link>
                </section>
            )}
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            {notice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
            {inProgress && (
                <section aria-labelledby="checkout-in-progress" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950 sm:p-6">
                    <h3 id="checkout-in-progress" className="text-base font-semibold">{CHECKOUT_IN_PROGRESS}</h3>
                    {inProgress.checkoutId ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                            <button type="button" className={OWNER_PRIMARY} disabled={busy} onClick={() => continuePayment(inProgress.checkoutId!)}>Continue to payment</button>
                            <button type="button" className={OWNER_SECONDARY} disabled={busy} onClick={() => cancelPayment(inProgress.checkoutId!)}>Cancel it</button>
                        </div>
                    ) : (
                        <p className="mt-1">It was started elsewhere. Finish it there, or try again later.</p>
                    )}
                </section>
            )}
            {view.renewal && <RenewalNotice renewal={view.renewal} busy={busy} onUpdateCard={updateCard} />}
            {view.paymentUnderReview && !view.renewal?.refund && (
                <section aria-labelledby="payment-review" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950 sm:p-6">
                    <h3 id="payment-review" className="text-base font-semibold">Payment under review</h3>
                    <p className="mt-1">
                        {"We're reviewing a payment"}{money(view.paymentUnderReview.amountMinor, view.paymentUnderReview.currency)
                            ? ` of ${money(view.paymentUnderReview.amountMinor, view.paymentUnderReview.currency)}` : ""}. Plan changes wait until it&apos;s resolved; your menus stay as they are.
                    </p>
                </section>
            )}

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
                        {current.graceUntil && current.status === "ACTIVE" && view.renewal?.state !== "PAST_DUE" && (
                            <button type="button" className={`mt-3 ${OWNER_SECONDARY}`} disabled={busy} onClick={updateCard}>Update card</button>
                        )}
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
                            const paymentUnavailable = p.paid && !isCurrent && mayChoosePaid && !canSubscribe(p.code);
                            return (
                                <li key={p.code} className="flex">
                                    <article aria-labelledby={`plan-${p.code}`} aria-describedby={paymentUnavailable ? `plan-${p.code}-payment` : undefined}
                                             className={`flex w-full flex-col rounded-2xl border bg-white p-5 shadow-sm ${isCurrent || isRequested ? "border-gray-900 ring-1 ring-gray-900" : "border-gray-200"}`}>
                                        <div className="flex items-start justify-between gap-2">
                                            <h4 id={`plan-${p.code}`} className="text-lg font-semibold text-gray-900">{planName(p.code)}</h4>
                                            {isCurrent && <span className="rounded-full bg-gray-900 px-2.5 py-0.5 text-xs font-semibold text-white">Current plan</span>}
                                            {isRequested && <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900">Requested</span>}
                                        </div>
                                        {p.paid && (
                                            pricesOf(p.code).length > 0 ? (
                                                <ul aria-label={`${planName(p.code)} price`} className="mt-2 text-sm font-semibold text-gray-900">
                                                    {pricesOf(p.code).map((pr) => <li key={pr.id}>{priceLine(pr)}</li>)}
                                                </ul>
                                            ) : <p className="mt-2 text-sm text-gray-700">{PRICE_NOT_AVAILABLE}</p>
                                        )}
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
                                        ) : p.paid && canSubscribe(p.code) ? (
                                            <div className="mt-4">
                                                {pricesOf(p.code).length > 1 && (
                                                    <fieldset className="mb-3 text-sm text-gray-900">
                                                        <legend className="mb-1 font-medium">Billing period for {planName(p.code)}</legend>
                                                        {pricesOf(p.code).map((pr, i) => (
                                                            <label key={pr.id} className="flex items-center gap-2 py-0.5">
                                                                <input type="radio" name={`period-${p.code}`} value={pr.id}
                                                                       checked={(period[p.code] ?? pricesOf(p.code)[0].id) === pr.id || (!period[p.code] && i === 0)}
                                                                       onChange={() => setPeriod((s) => ({ ...s, [p.code]: pr.id }))} />
                                                                {priceLine(pr)}
                                                            </label>
                                                        ))}
                                                    </fieldset>
                                                )}
                                                {mustVerifyToPay && <p className="mb-2 text-sm text-gray-800">{CHECKOUT_VERIFY}</p>}
                                                <button type="button" className={`${OWNER_PRIMARY} w-full`} disabled={busy || mustVerifyToPay}
                                                        onClick={() => subscribe(p.code, period[p.code] ?? pricesOf(p.code)[0].id)}>
                                                    Subscribe
                                                </button>
                                            </div>
                                        ) : paymentUnavailable ? (
                                            <p id={`plan-${p.code}-payment`} className="mt-4 border-t border-gray-200 pt-3 text-sm font-medium text-gray-700">
                                                {PAYMENT_NOT_AVAILABLE}
                                            </p>
                                        ) : canRequestFree(p.code) && (
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
                {setting2 && anySubscribe && <p>{CHECKOUT_NOTE}</p>}
                {setting2 && anyFreeRequest && !anySubscribe && <p>{ACTIVATION_NOTE}</p>}
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
            {/* AGF FE-R2: the owner's notice list (N2) */}
            <NoticeList />
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

// AGF FE-R1 (addendum §13): one notice per renewal state, with its dates in the restaurant's time zone
function RenewalNotice({ renewal, busy, onUpdateCard }: { renewal: OwnerRenewal; busy: boolean; onUpdateCard: () => void }) {
    const refund = renewal.refund;
    const amount = refund ? money(refund.amountMinor, refund.currency) : "";
    const refundText = refund
        ? refund.reason === "RENEWAL_DUPLICATE_PERIOD"
            ? `A duplicate payment${amount ? ` of ${amount}` : ""} will be refunded.`
            : `The payment${amount ? ` of ${amount}` : ""} made after your plan ended will be refunded.`
        : "";
    if (renewal.state === "PAST_DUE") {
        return (
            <section aria-labelledby="renewal-past-due" className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 sm:p-6">
                <h3 id="renewal-past-due" className="text-base font-semibold">Payment failed</h3>
                <p className="mt-1">
                    {"We couldn't renew your plan."}{renewal.graceUntil ? ` Update your card by ${trialEndDate(renewal.graceUntil, renewal.timeZone)} to keep it.` : " Update your card to keep it."}
                    {" "}Until then everything keeps working.
                </p>
                {refundText && <p className="mt-1">{refundText}</p>}
                <button type="button" className={`mt-3 ${OWNER_PRIMARY}`} disabled={busy} onClick={onUpdateCard}>Update card</button>
            </section>
        );
    }
    if (renewal.state === "ENDED_PAYMENT_FAILED") {
        return (
            <section aria-labelledby="renewal-ended" className="rounded-2xl border border-gray-300 bg-gray-50 p-5 text-sm text-gray-900 sm:p-6">
                <h3 id="renewal-ended" className="text-base font-semibold">Your plan ended</h3>
                <p className="mt-1">
                    Your plan ended{renewal.endedAt ? ` on ${trialEndDate(renewal.endedAt, renewal.timeZone)}` : ""} because the payment didn&apos;t go through. Your published menus stay online; choose a plan to continue.
                </p>
                {refundText && <p className="mt-1">{refundText}</p>}
            </section>
        );
    }
    return (
        <section aria-labelledby="renewal-refund" className="rounded-2xl border border-gray-300 bg-gray-50 p-5 text-sm text-gray-900 sm:p-6">
            <h3 id="renewal-refund" className="text-base font-semibold">Refund in progress</h3>
            <p className="mt-1">{refundText || "A payment will be refunded."} Your plan isn&apos;t affected.</p>
        </section>
    );
}
