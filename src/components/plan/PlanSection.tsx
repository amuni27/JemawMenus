import { useCallback, useEffect, useState } from "react";
import planApi, { type OwnerPlanView } from "../../api/planApi";
import Modal from "../ui/Modal";
import ModalHeader from "../ui/ModalHeader";
import { errorMessage } from "../../utils/errorMessage";
import { FEATURES_NOTE, OWNER_PRIMARY, OWNER_SECONDARY, PLAN_DESCRIPTIONS, modelName, statusLabel } from "./planText";

// AGF E4-M4: the owner's Plan section on the account page. Hidden unless the backend says plans are visible. Under
// Setting 2 the owner requests one of the enabled plans (a request, never a subscription); under Setting 1 status only;
// with a current subscription no request or change. No prices; every feature stays available (no enforcement).

type Dialog = { kind: "request"; planCode: string } | { kind: "withdraw" } | null;

export default function PlanSection() {
    const [view, setView] = useState<OwnerPlanView | null>(null);
    const [dialog, setDialog] = useState<Dialog>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    const load = useCallback(() => planApi.get().then((res) => setView(res.data), () => setView({ visible: false })), []);
    useEffect(() => { load(); }, [load]);

    if (!view?.visible) return null;

    const run = async (action: () => Promise<unknown>) => {
        setBusy(true);
        setError("");
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

    return (
        <section id="plan" role="region" aria-labelledby="plan-heading" className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 id="plan-heading" className="text-base font-semibold text-gray-900">Plan</h3>
            {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}

            {current && (
                <div className="mt-3 text-sm text-gray-800">
                    <p className="font-semibold">{modelName(current.planCode)} · {statusLabel(current.status)}</p>
                    <p className="text-gray-700">{PLAN_DESCRIPTIONS[current.planCode]}</p>
                    {current.sourceLabel && <p className="mt-1 text-xs text-gray-700">{current.sourceLabel}</p>}
                    {current.periodEnd && <p className="mt-1 text-gray-700">Current period ends {new Date(current.periodEnd).toLocaleDateString()}</p>}
                    {current.outsideCurrentConfiguration && <p className="mt-1 text-gray-700">Your plan stays as it is for now.</p>}
                </div>
            )}

            {!current && view.setting === "SETTING_1" && (
                <div className="mt-3 text-sm text-gray-800">
                    <p>Your plan model: free trial, then a paid subscription.</p>
                    <p className="mt-1 text-gray-700">Trial details aren't available yet.</p>
                </div>
            )}

            {!current && pending && (
                <div className="mt-3 text-sm text-gray-800">
                    <p>Request for {modelName(pending.planCode)} sent on {new Date(pending.requestedAt).toLocaleDateString()}. The Agafari team will contact you.</p>
                    <button type="button" className={`${OWNER_SECONDARY} mt-3`} onClick={() => setDialog({ kind: "withdraw" })} disabled={busy}>
                        Withdraw request
                    </button>
                </div>
            )}

            {!current && !pending && view.setting === "SETTING_2" && (
                <>
                    <p className="mt-2 text-sm text-gray-700">Choose the plan that suits your restaurant. Pricing will be announced.</p>
                    <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                        {(view.plans ?? []).map((p) => (
                            <li key={p.code} className="rounded-xl border border-gray-200 p-4 text-sm">
                                <p className="font-semibold text-gray-900">{modelName(p.code)}</p>
                                <p className="text-gray-700">{PLAN_DESCRIPTIONS[p.code]}</p>
                                {view.canRequest && (
                                    <button type="button" className={`${OWNER_PRIMARY} mt-3`} onClick={() => setDialog({ kind: "request", planCode: p.code })}
                                            disabled={busy}>
                                        Request {modelName(p.code)}
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>
                </>
            )}

            <p className="mt-4 text-xs text-gray-700">{FEATURES_NOTE}</p>

            <Modal open={dialog?.kind === "request"} onClose={() => !busy && setDialog(null)} className="max-w-md">
                <div role="dialog" aria-modal="true" aria-label="Request a plan">
                    <ModalHeader title="Request a plan" onClose={() => !busy && setDialog(null)} />
                    <p className="text-sm text-gray-800">{dialog?.kind === "request" ? `${modelName(dialog.planCode)}: ${PLAN_DESCRIPTIONS[dialog.planCode]}` : ""}</p>
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

            <Modal open={dialog?.kind === "withdraw"} onClose={() => !busy && setDialog(null)} className="max-w-md">
                <div role="dialog" aria-modal="true" aria-label="Withdraw request">
                    <ModalHeader title="Withdraw request" onClose={() => !busy && setDialog(null)} />
                    <p className="text-sm text-gray-800">Withdraw your request for {pending ? modelName(pending.planCode) : ""}?</p>
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
