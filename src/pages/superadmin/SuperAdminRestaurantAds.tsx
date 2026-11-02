import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../../api/adminApi';
import type { RestaurantAd } from '../../api/restaurantAdsApi';
import Modal from '../../components/ui/Modal';
import ModalHeader from '../../components/ui/ModalHeader';
import { errorMessage } from '../../utils/errorMessage';
import { PRIMARY, SECONDARY } from './consoleButtons';

// AGF E4-M8 (Q-M8-2): oversight of restaurant-managed ads (Model 3). Ads go live without review; the Super Admin can
// suspend one with a reason the restaurant sees, and reinstate it to Paused (the restaurant decides when it runs again).
// No create, edit or archive here: the content is the restaurant's.

const STATUS: Record<RestaurantAd['status'], string> = { ACTIVE: 'Active', PAUSED: 'Paused', SUSPENDED: 'Suspended', ARCHIVED: 'Archived' };
const when = (local?: string, offset?: string, zone?: string) => (local ? `${local.replace('T', ' ')} (${zone}, UTC${offset})` : '');

export default function SuperAdminRestaurantAds() {
  const [list, setList] = useState<RestaurantAd[] | null>(null);
  const [status, setStatus] = useState('');
  const [suspending, setSuspending] = useState<RestaurantAd | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback((s: string) => adminApi.restaurantAds(s ? { status: s } : {}).then((res) => setList(res.data)), []);
  useEffect(() => {
    load(status).catch((err) => setError(errorMessage(err, "Couldn't load the restaurant ads.")));
  }, [load, status]);

  const act = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (err) {
      setError(errorMessage(err, "Couldn't save the change."));
    } finally {
      setSuspending(null);
      setReason('');
      setBusy(false);
      await load(status).catch(() => undefined);
    }
  };

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <h1 className="text-xl font-bold text-gray-900">Restaurant ads</h1>
      <p className="mt-1 text-sm text-gray-600">Ads that Model 3 restaurants show on their own guest menus. They go live without review; suspend one that breaks the rules.</p>
      <p className="mt-1 text-xs text-gray-600">Reinstated ads return to Paused; the restaurant decides when they run again.</p>
      <label className="mt-3 flex max-w-xs flex-col text-sm text-gray-800">
        Status
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="mt-1 rounded-lg border border-gray-300 px-3 py-2">
          <option value="">All</option>
          {(['ACTIVE', 'PAUSED', 'SUSPENDED', 'ARCHIVED'] as const).map((s) => <option key={s} value={s}>{STATUS[s]}</option>)}
        </select>
      </label>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      {list && list.length === 0 && <p className="mt-3 text-sm text-gray-600">No restaurant ads.</p>}
      {list && list.length > 0 && (
        <div role="region" aria-label="Restaurant ads (scrolls sideways)" tabIndex={0}
             className="mt-3 overflow-x-auto rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900">
          <table aria-label="Restaurant ads" className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b text-gray-600">
                <th scope="col" className="py-2 pr-4 font-semibold">Restaurant</th>
                <th scope="col" className="py-2 pr-4 font-semibold">Ad</th>
                <th scope="col" className="py-2 pr-4 font-semibold">Status</th>
                <th scope="col" className="py-2 pr-4 font-semibold">Schedule</th>
                <th scope="col" className="py-2 pr-4 font-semibold"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {list.map((a) => (
                <tr key={a.id} className="border-b align-top last:border-0">
                  <td className="py-2 pr-4">{a.businessName ?? a.businessId}</td>
                  <td className="py-2 pr-4"><p className="font-medium text-gray-900">{a.title}</p><p className="text-gray-700">{a.body}</p><p className="text-gray-600">{a.linkUrl}</p></td>
                  <td className="py-2 pr-4">
                    <p>{STATUS[a.status]}</p>
                    {a.suspensionReason && <p className="text-gray-700">Reason: {a.suspensionReason}</p>}
                  </td>
                  <td className="py-2 pr-4 text-gray-700">
                    <p>Starts {when(a.startLocal, a.startOffset, a.scheduleTimeZone)}</p>
                    <p>{a.endLocal ? `Ends ${when(a.endLocal, a.endOffset, a.scheduleTimeZone)}` : 'No end'}</p>
                  </td>
                  <td className="py-2 pr-4">
                    {(a.status === 'ACTIVE' || a.status === 'PAUSED') && (
                      <button type="button" className={SECONDARY} aria-label={`Suspend ${a.title}`} onClick={() => { setSuspending(a); setReason(''); }} disabled={busy}>Suspend</button>
                    )}
                    {a.status === 'SUSPENDED' && (
                      <button type="button" className={SECONDARY} aria-label={`Reinstate ${a.title}`}
                              onClick={() => act(() => adminApi.reinstateRestaurantAd(a.id, a.rowVersion))} disabled={busy}>Reinstate</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={suspending !== null} onClose={() => !busy && setSuspending(null)} className="max-w-md">
        <div role="dialog" aria-modal="true" aria-label="Suspend ad">
          <ModalHeader title="Suspend ad" onClose={() => !busy && setSuspending(null)} />
          <p className="text-sm text-gray-800">{suspending?.title} ({suspending?.businessName}): it stops being shown at once. The restaurant can edit or archive it, but only you can reinstate it.</p>
          <label className="mt-3 flex flex-col text-sm text-gray-800">
            Reason (shown to the restaurant)
            <textarea value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} className="mt-1 rounded-lg border border-gray-300 px-3 py-2" />
          </label>
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" className={SECONDARY} onClick={() => setSuspending(null)} disabled={busy}>Cancel</button>
            <button type="button" className={PRIMARY} disabled={busy || reason.trim() === ''}
                    onClick={() => suspending && act(() => adminApi.suspendRestaurantAd(suspending.id, reason.trim(), suspending.rowVersion))}>
              {busy ? 'Suspending…' : 'Suspend'}
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
