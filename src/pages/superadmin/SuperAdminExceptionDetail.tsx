import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { adminApi, type BillingExceptionHistoryItem, type BillingExceptionView } from '../../api/adminApi';
import Modal from '../../components/ui/Modal';
import ModalHeader from '../../components/ui/ModalHeader';
import { errorMessage, isNotFound } from '../../utils/errorMessage';
import { PRIMARY, SECONDARY } from './consoleButtons';
import { actionLabel, codeLabel, money, NO_RESTAURANT, RESOLUTION_LABELS, statusLabel, when } from './exceptionText';

// AGF EX-F (register §91, PO F-3): one billing exception, its facts and history, and the existing audited actions. Each
// action sends the row version back; the backend decides. The escalation target is typed by the Super Admin, never
// prefilled or assigned automatically (G3-A). Nothing here charges, refunds or activates anything.

type Dialog = 'note' | 'escalate' | 'resolve' | 'replay' | null;

const CAN = {
  claim: ['OPEN'],
  note: ['AUTO_HANDLING', 'OPEN', 'IN_REVIEW', 'ESCALATED'],
  escalate: ['OPEN', 'IN_REVIEW'],
  resolve: ['OPEN', 'IN_REVIEW', 'ESCALATED'],
  replay: ['OPEN', 'IN_REVIEW', 'ESCALATED'],
};

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 py-1.5 sm:grid-cols-3">
      <dt className="font-medium text-gray-700">{label}</dt>
      <dd className="break-words text-gray-900 sm:col-span-2">{children}</dd>
    </div>
  );
}

export default function SuperAdminExceptionDetail() {
  const { id = '' } = useParams();
  const [view, setView] = useState<BillingExceptionView | null>(null);
  const [history, setHistory] = useState<BillingExceptionHistoryItem[]>([]);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [target, setTarget] = useState('');
  const [resolution, setResolution] = useState('');
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    try {
      const [v, h] = await Promise.all([adminApi.exception(id), adminApi.exceptionHistory(id)]);
      setView(v.data);
      setHistory(h.data);
      setLoadError('');
    } catch (err) {
      setLoadError(isNotFound(err) ? "This exception wasn't found." : errorMessage(err, "Couldn't load the exception."));
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const open = (d: Dialog) => {
    setNote('');
    setReason('');
    setTarget(''); // never prefilled (G3-A)
    setResolution('');
    setFormError('');
    setDialog(d);
  };

  const run = async (action: () => Promise<unknown>, after?: (result: unknown) => void) => {
    setBusy(true);
    setActionError('');
    setNotice('');
    try {
      const result = await action();
      after?.(result);
      setDialog(null);
      await load();
    } catch (err) {
      setDialog(null);
      setActionError(errorMessage(err, "Couldn't complete the action. Reload and try again."));
    } finally {
      setBusy(false);
    }
  };

  if (loadError) {
    return (
      <section className="space-y-3 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <p role="alert" className="text-sm text-red-700">{loadError}</p>
        <Link to="/super-admin/exceptions" className="text-sm font-medium text-gray-900 underline">Back to exceptions</Link>
      </section>
    );
  }
  if (!view) return <p className="text-sm text-gray-500">Loading…</p>;

  const v = view;
  const allowed = (k: keyof typeof CAN) => CAN[k].includes(v.status) && (k !== 'replay' || !!v.providerEventId);
  const anyAction = (Object.keys(CAN) as (keyof typeof CAN)[]).some(allowed);

  const saveNote = () => {
    if (!note.trim()) return setFormError('Write a note.');
    void run(() => adminApi.addExceptionNote(v.id, v.rowVersion, note.trim()));
  };
  const escalate = () => {
    if (!reason.trim()) return setFormError('Give a reason.');
    void run(() => adminApi.escalateException(v.id, v.rowVersion, reason.trim(), target.trim() || null));
  };
  const resolve = () => {
    if (!resolution || !note.trim()) return setFormError('Choose an outcome and write a note.');
    void run(() => adminApi.resolveException(v.id, v.rowVersion, resolution, note.trim()));
  };
  const replay = () => void run(() => adminApi.replayException(v.id, v.rowVersion),
    (res) => setNotice(`Replay result: ${(res as { data: { eventResult: string } }).data.eventResult}`));

  const field = 'mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm';

  return (
    <div className="space-y-4">
      <Link to="/super-admin/exceptions" className="text-sm font-medium text-gray-900 underline">Back to exceptions</Link>
      <section className="space-y-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h1 className="text-xl font-bold text-gray-900">{codeLabel(v.code)}</h1>
        {actionError && <p role="alert" className="text-sm text-red-700">{actionError}</p>}
        {notice && <p role="status" className="text-sm text-emerald-800">{notice}</p>}

        <section aria-labelledby="exception-facts">
          <h2 id="exception-facts" className="text-base font-semibold text-gray-900">Facts</h2>
          <dl className="mt-2 divide-y divide-gray-100 text-sm">
            <Fact label="Status">{statusLabel(v.status)}</Fact>
            <Fact label="Restaurant">{v.businessId ?? NO_RESTAURANT}</Fact>
            <Fact label="Amount">{money(v.amountMinor, v.currency)}</Fact>
            <Fact label="Paid at">{when(v.paidAt)}</Fact>
            <Fact label="Opened">{when(v.createdAt)}</Fact>
            <Fact label="Due">
              {when(v.dueAt)}
              {v.overdue && <span className="ml-2 rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-900">Overdue</span>}
            </Fact>
            {v.claimedAt && <Fact label="Claimed">{when(v.claimedAt)}</Fact>}
            {v.escalatedAt && <Fact label="Escalated">{when(v.escalatedAt)}: {v.escalationReason}{v.escalatedTo ? ` (to ${v.escalatedTo})` : ''}</Fact>}
            {v.resolution && <Fact label="Resolution">{RESOLUTION_LABELS[v.resolution] ?? v.resolution}{v.resolutionNote ? `: ${v.resolutionNote}` : ''}</Fact>}
            {v.providerEventId && <Fact label="Provider event"><span className="font-mono text-xs">{v.providerEventId}</span></Fact>}
            {v.sourceJobId && <Fact label="Failed job"><span className="font-mono text-xs">{v.sourceJobId}</span></Fact>}
            {v.paymentId && <Fact label="Payment"><span className="font-mono text-xs">{v.paymentId}</span></Fact>}
            {v.checkoutId && <Fact label="Checkout"><span className="font-mono text-xs">{v.checkoutId}</span></Fact>}
            {v.refundRequestId && <Fact label="Refund request"><span className="font-mono text-xs">{v.refundRequestId}</span></Fact>}
          </dl>
        </section>

        {anyAction && (
          <section aria-labelledby="exception-actions">
            <h2 id="exception-actions" className="text-base font-semibold text-gray-900">Actions</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {allowed('claim') && <button type="button" className={PRIMARY} disabled={busy} onClick={() => void run(() => adminApi.claimException(v.id, v.rowVersion))}>Claim</button>}
              {allowed('note') && <button type="button" className={SECONDARY} disabled={busy} onClick={() => open('note')}>Add note</button>}
              {allowed('escalate') && <button type="button" className={SECONDARY} disabled={busy} onClick={() => open('escalate')}>Escalate</button>}
              {allowed('resolve') && <button type="button" className={SECONDARY} disabled={busy} onClick={() => open('resolve')}>Resolve</button>}
              {allowed('replay') && <button type="button" className={SECONDARY} disabled={busy} onClick={() => open('replay')}>Replay</button>}
            </div>
          </section>
        )}

        <section aria-labelledby="exception-history">
          <h2 id="exception-history" className="text-base font-semibold text-gray-900">History</h2>
          {history.length === 0 ? <p className="mt-2 text-sm text-gray-600">No history yet.</p> : (
            <ol className="mt-2 space-y-2 text-sm">
              {history.map((h) => (
                <li key={h.id} className="rounded-lg border border-gray-100 p-2">
                  <p className="font-medium text-gray-900">{actionLabel(h.action)} <span className="font-normal text-gray-600">· {when(h.occurredAt)} · {h.actorLabel}</span></p>
                  {h.detail && <p className="mt-1 break-words text-gray-800">{h.detail}</p>}
                </li>
              ))}
            </ol>
          )}
        </section>
      </section>

      <Modal open={dialog === 'note'} onClose={() => !busy && setDialog(null)} className="max-w-md">
        <div role="dialog" aria-modal="true" aria-label="Add a note">
          <ModalHeader title="Add a note" onClose={() => !busy && setDialog(null)} />
          <label htmlFor="exception-note" className="block text-sm font-medium text-gray-900">Note</label>
          <textarea id="exception-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} className={field} maxLength={400} />
          {formError && <p role="alert" className="mt-2 text-sm text-red-700">{formError}</p>}
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" className={SECONDARY} onClick={() => setDialog(null)} disabled={busy}>Cancel</button>
            <button type="button" className={PRIMARY} onClick={saveNote} disabled={busy}>Save note</button>
          </div>
        </div>
      </Modal>

      <Modal open={dialog === 'escalate'} onClose={() => !busy && setDialog(null)} className="max-w-md">
        <div role="dialog" aria-modal="true" aria-label="Escalate this exception">
          <ModalHeader title="Escalate this exception" onClose={() => !busy && setDialog(null)} />
          <label htmlFor="exception-reason" className="block text-sm font-medium text-gray-900">Reason</label>
          <textarea id="exception-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className={field} maxLength={400} />
          <label htmlFor="exception-target" className="mt-3 block text-sm font-medium text-gray-900">Escalate to (optional)</label>
          <input id="exception-target" value={target} onChange={(e) => setTarget(e.target.value)} className={field} maxLength={255} autoComplete="off"
                 aria-describedby="exception-target-help" />
          <p id="exception-target-help" className="mt-1 text-xs text-gray-600">Name the person or role. Nothing is assigned automatically.</p>
          {formError && <p role="alert" className="mt-2 text-sm text-red-700">{formError}</p>}
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" className={SECONDARY} onClick={() => setDialog(null)} disabled={busy}>Cancel</button>
            <button type="button" className={PRIMARY} onClick={escalate} disabled={busy}>Escalate</button>
          </div>
        </div>
      </Modal>

      <Modal open={dialog === 'resolve'} onClose={() => !busy && setDialog(null)} className="max-w-md">
        <div role="dialog" aria-modal="true" aria-label="Resolve this exception">
          <ModalHeader title="Resolve this exception" onClose={() => !busy && setDialog(null)} />
          <p className="text-sm text-gray-800">Resolving records what happened. It doesn't move money.</p>
          <fieldset className="mt-3">
            <legend className="text-sm font-medium text-gray-900">Outcome</legend>
            {(['FUNDS_HANDLED_EXTERNALLY', 'NO_ACTION_REQUIRED'] as const).map((r) => (
              <label key={r} className="mt-1 flex items-center gap-2 text-sm">
                <input type="radio" name="exception-resolution" value={r} checked={resolution === r} onChange={() => setResolution(r)} />
                {RESOLUTION_LABELS[r]}
              </label>
            ))}
          </fieldset>
          <label htmlFor="exception-resolution-note" className="mt-3 block text-sm font-medium text-gray-900">Note</label>
          <textarea id="exception-resolution-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} className={field} maxLength={400} />
          {formError && <p role="alert" className="mt-2 text-sm text-red-700">{formError}</p>}
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" className={SECONDARY} onClick={() => setDialog(null)} disabled={busy}>Cancel</button>
            <button type="button" className={PRIMARY} onClick={resolve} disabled={busy}>Resolve</button>
          </div>
        </div>
      </Modal>

      <Modal open={dialog === 'replay'} onClose={() => !busy && setDialog(null)} className="max-w-md">
        <div role="dialog" aria-modal="true" aria-label="Replay the payment event?">
          <ModalHeader title="Replay the payment event?" onClose={() => !busy && setDialog(null)} />
          <p className="text-sm text-gray-800">Agafari checks the payment with the provider again and applies the result only if the evidence is valid. Nothing is charged or refunded.</p>
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" className={SECONDARY} onClick={() => setDialog(null)} disabled={busy}>Cancel</button>
            <button type="button" className={PRIMARY} onClick={replay} disabled={busy}>Replay</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
