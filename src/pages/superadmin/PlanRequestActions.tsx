import { useState } from 'react';
import { adminApi } from '../../api/adminApi';
import Modal from '../../components/ui/Modal';
import ModalHeader from '../../components/ui/ModalHeader';
import { PRIMARY, SECONDARY } from './consoleButtons';

// AGF E4-M4: Fulfil (records the E4-M3 manual subscription for the requested plan, no payment verified) and Decline for one
// pending plan request, each after a confirmation. A request outside the current configuration can only be declined.

type Props = {
  request: { id: string; planCode: string; rowVersion: number; outsideCurrentConfiguration: boolean };
  restaurant: string;
  configVersion: number;
  onDone: (error?: unknown) => void;
};

const model = (code: string) => `Model ${code.slice(-1)}`;

export default function PlanRequestActions({ request, restaurant, configVersion, onDone }: Props) {
  const [dialog, setDialog] = useState<'fulfil' | 'decline' | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    let failure: unknown;
    try {
      await action();
    } catch (err) {
      failure = err;
    }
    setBusy(false);
    setDialog(null);
    onDone(failure);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {!request.outsideCurrentConfiguration && (
        <button type="button" className={PRIMARY} aria-label={`Fulfil request from ${restaurant}`} onClick={() => setDialog('fulfil')} disabled={busy}>
          Fulfil
        </button>
      )}
      <button type="button" className={SECONDARY} aria-label={`Decline request from ${restaurant}`} onClick={() => setDialog('decline')} disabled={busy}>
        Decline
      </button>

      <Modal open={dialog === 'fulfil'} onClose={() => !busy && setDialog(null)} className="max-w-md">
        <div role="dialog" aria-modal="true" aria-label="Fulfil plan request">
          <ModalHeader title="Fulfil plan request" onClose={() => !busy && setDialog(null)} />
          <p className="text-sm text-gray-800">Records a {model(request.planCode)} subscription for {restaurant}.</p>
          <p className="mt-3 text-sm font-medium text-amber-900">Manual record. No payment is taken or verified.</p>
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" className={SECONDARY} onClick={() => setDialog(null)} disabled={busy}>Cancel</button>
            <button type="button" className={PRIMARY} disabled={busy}
                    onClick={() => run(() => adminApi.fulfilPlanRequest(request.id, configVersion, request.rowVersion))}>
              {busy ? 'Saving…' : 'Fulfil'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={dialog === 'decline'} onClose={() => !busy && setDialog(null)} className="max-w-md">
        <div role="dialog" aria-modal="true" aria-label="Decline plan request">
          <ModalHeader title="Decline plan request" onClose={() => !busy && setDialog(null)} />
          <p className="text-sm text-gray-800">Decline the {model(request.planCode)} request from {restaurant}? The request is kept in the history.</p>
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" className={SECONDARY} onClick={() => setDialog(null)} disabled={busy}>Cancel</button>
            <button type="button" className={PRIMARY} disabled={busy} onClick={() => run(() => adminApi.declinePlanRequest(request.id, request.rowVersion))}>
              {busy ? 'Declining…' : 'Decline'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
