import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  adminApi, type AdminBusinessPage, type BusinessSubscriptionView, type MonetizationModel, type Subscription, type SubscriptionPlan,
} from '../../api/adminApi';
import Modal from '../../components/ui/Modal';
import ModalHeader from '../../components/ui/ModalHeader';
import { errorMessage } from '../../utils/errorMessage';
import { PRIMARY, SECONDARY } from './consoleButtons';
import PlanRequestActions from './PlanRequestActions';

// AGF E4-M3: manual subscription records (E4-Q7: no payment taken or verified). Record only when a restaurant has no
// current subscription and only for plans the current configuration enables; end it as a separate action. Plans never
// change here (D-M3-10); ended subscriptions stay in the history (D-M3-11). Nothing changes automatically.

const PAGE_SIZE = 20;
const model = (code: string | null | undefined) => (code ? `Model ${code.slice(-1)}` : '');
const date = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString() : '');

type Dialog = 'record' | 'end' | null;

export default function SuperAdminSubscriptions() {
  const [query, setQuery] = useState('');
  const [list, setList] = useState<AdminBusinessPage | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [configVersion, setConfigVersion] = useState(0);
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);
  const [view, setView] = useState<BusinessSubscriptionView | null>(null);
  const [history, setHistory] = useState<Subscription[]>([]);
  const [planCode, setPlanCode] = useState<MonetizationModel | ''>('');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const search = useCallback((q: string) => {
    adminApi.businesses(q, 0, PAGE_SIZE).then((res) => setList(res.data),
      (err) => setError(errorMessage(err, "Couldn't load the restaurants.")));
  }, []);

  const loadReference = useCallback(async () => {
    const [p, c] = await Promise.all([adminApi.plans(), adminApi.monetizationConfig()]);
    setPlans(p.data);
    setConfigVersion(c.data.version ?? 0);
  }, []);

  const loadRestaurant = useCallback(async (id: string) => {
    const [v, h] = await Promise.all([adminApi.businessSubscription(id), adminApi.subscriptionHistory(id)]);
    setView(v.data);
    setHistory(h.data);
  }, []);

  useEffect(() => {
    search('');
    loadReference().catch((err) => setError(errorMessage(err, "Couldn't load the plans.")));
  }, [search, loadReference]);

  const open = (id: string, name: string) => {
    setSelected({ id, name });
    setView(null);
    setPlanCode('');
    setError('');
    loadRestaurant(id).catch((err) => setError(errorMessage(err, "Couldn't load the subscription.")));
  };

  const run = async (action: () => Promise<unknown>) => {
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      await action();
      setPlanCode('');
    } catch (err) {
      setError(errorMessage(err, "Couldn't save the change."));
      if ((err as { response?: { status?: number } })?.response?.status === 409) await loadReference().catch(() => undefined);
    } finally {
      setDialog(null);
      setBusy(false);
      await loadRestaurant(selected.id).catch(() => undefined);
      search(query);
    }
  };

  const record = () => run(() => adminApi.recordSubscription(selected!.id, { planCode: planCode as MonetizationModel, expectedConfigVersion: configVersion }));
  const end = () => run(() => adminApi.endSubscription(selected!.id, view!.current!.rowVersion));
  const enabledPlans = plans.filter((p) => p.enabledByCurrentConfiguration);
  const current = view?.current;

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h1 className="text-xl font-bold text-gray-900">Subscriptions</h1>
        <p className="mt-1 text-sm text-gray-600">Manual records only: no payment is taken or verified here.</p>
        <form className="mt-4 flex flex-wrap items-end gap-2" onSubmit={(e: FormEvent) => { e.preventDefault(); search(query); }}>
          <label className="flex flex-col text-sm text-gray-800">
            Search restaurants
            <input value={query} onChange={(e) => setQuery(e.target.value)}
                   className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </label>
          <button type="submit" className={SECONDARY}>Search</button>
        </form>
        {list && list.items.length === 0 && <p className="mt-3 text-sm text-gray-600">No restaurants found.</p>}
        {list && list.items.length > 0 && (
          <div role="region" aria-label="Restaurants (scrolls sideways)" tabIndex={0}
               className="mt-4 overflow-x-auto rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900">
            <table aria-label="Restaurants" className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b text-gray-600">
                  <th scope="col" className="py-2 pr-4 font-semibold">Restaurant</th>
                  <th scope="col" className="py-2 pr-4 font-semibold">Address</th>
                  <th scope="col" className="py-2 pr-4 font-semibold">Subscription</th>
                  <th scope="col" className="py-2 pr-4 font-semibold"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((b) => (
                  <tr key={b.id} className="border-b last:border-0">
                    <td className="py-2 pr-4">{b.name}</td>
                    <td className="py-2 pr-4 text-gray-600">{b.slug}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">{b.subscriptionStatus ? `${b.subscriptionStatus} · ${model(b.planCode)}` : 'No subscription'}</td>
                    <td className="py-2 pr-4">
                      <button type="button" className={SECONDARY} aria-label={`Open ${b.name}`} onClick={() => open(b.id, b.name)}>Open</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {error && !selected && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      </section>

      {selected && (
        <section role="region" aria-label={`${selected.name} subscription`} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900">{selected.name}</h2>
          {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
          {!view && !error && <p className="mt-3 text-sm text-gray-500">Loading…</p>}
          {view && (
            <>
              {!view.monetizationActive && (
                <p className="mt-2 text-sm text-gray-600">Monetization is inactive: every restaurant keeps today's features.</p>
              )}
              <div className="mt-4 rounded-xl bg-gray-50 p-4 text-sm">
                {current ? (
                  <>
                    <p className="font-semibold text-gray-900">{model(current.planCode)} · {current.status}</p>
                    <p className="mt-1 inline-block rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">{current.sourceLabel}</p>
                    {current.outsideCurrentConfiguration && (
                      <p className="ml-2 mt-1 inline-block rounded bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-900">Outside current configuration</p>
                    )}
                    <p className="mt-2 text-gray-700">
                      Configuration version {current.configVersion} · recorded {date(current.createdAt)} by {current.createdBy}
                      {current.periodEnd ? ` · period ends ${date(current.periodEnd)}` : ''}
                    </p>
                    <p className="mt-1 text-gray-700">Ads: {view.entitlements.adSource === 'NONE' ? 'none' : view.entitlements.adSource.toLowerCase()}</p>
                    <button type="button" className={`${SECONDARY} mt-3`} onClick={() => setDialog('end')} disabled={busy}>End subscription</button>
                  </>
                ) : (
                  <p className="font-semibold text-gray-900">No subscription</p>
                )}
              </div>

              {!current && view.pendingRequest && (
                <div className="mt-4 rounded-xl border border-gray-200 p-4 text-sm">
                  <p className="font-semibold text-gray-900">Plan request: {model(view.pendingRequest.planCode)}</p>
                  <p className="mt-1 text-gray-700">Requested {date(view.pendingRequest.requestedAt)} by the owner. A manual record is possible only by fulfilling or declining it.</p>
                  {view.pendingRequest.outsideCurrentConfiguration && (
                    <p className="mt-1 inline-block rounded bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-900">Outside current configuration</p>
                  )}
                  <div className="mt-3">
                    <PlanRequestActions request={view.pendingRequest} restaurant={selected.name} configVersion={configVersion}
                                        onDone={(failure) => {
                                          setError(failure ? errorMessage(failure, "Couldn't save the change.") : '');
                                          loadRestaurant(selected.id).catch(() => undefined);
                                          search(query);
                                        }} />
                  </div>
                </div>
              )}

              {!current && !view.pendingRequest && (
                <div className="mt-4 flex flex-wrap items-end gap-2">
                  <label className="flex flex-col text-sm text-gray-800">
                    Plan
                    <select value={planCode} onChange={(e) => setPlanCode(e.target.value as MonetizationModel | '')}
                            className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm">
                      <option value="">Choose a plan</option>
                      {enabledPlans.map((p) => <option key={p.code} value={p.code}>{model(p.code)}</option>)}
                    </select>
                  </label>
                  <button type="button" className={PRIMARY} disabled={!planCode || busy} onClick={() => setDialog('record')}>Record subscription</button>
                  {enabledPlans.length === 0 && <p className="text-sm text-gray-600">Set up the monetization configuration first.</p>}
                </div>
              )}

              <h3 className="mt-6 text-base font-semibold text-gray-900">History</h3>
              {history.length === 0 && <p className="mt-2 text-sm text-gray-600">No subscriptions yet.</p>}
              {history.length > 0 && (
                <div role="region" aria-label="Subscription history (scrolls sideways)" tabIndex={0}
                     className="mt-2 overflow-x-auto rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900">
                  <table aria-label="Subscription history" className="min-w-full text-left text-sm">
                    <thead>
                      <tr className="border-b text-gray-600">
                        <th scope="col" className="py-2 pr-4 font-semibold">Plan</th>
                        <th scope="col" className="py-2 pr-4 font-semibold">Status</th>
                        <th scope="col" className="py-2 pr-4 font-semibold">Configuration</th>
                        <th scope="col" className="py-2 pr-4 font-semibold">Recorded</th>
                        <th scope="col" className="py-2 pr-4 font-semibold">Ended</th>
                        <th scope="col" className="py-2 pr-4 font-semibold">Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((s) => (
                        <tr key={s.id} className="border-b last:border-0">
                          <td className="py-2 pr-4 whitespace-nowrap">{model(s.planCode)}</td>
                          <td className="py-2 pr-4">{s.status}</td>
                          <td className="py-2 pr-4 whitespace-nowrap">Version {s.configVersion}</td>
                          <td className="py-2 pr-4 whitespace-nowrap">{date(s.createdAt)}</td>
                          <td className="py-2 pr-4 whitespace-nowrap">{date(s.endedAt)}</td>
                          <td className="py-2 pr-4">{s.sourceLabel ?? s.source}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>
      )}

      <Modal open={dialog === 'record'} onClose={() => !busy && setDialog(null)} className="max-w-md">
        <div role="dialog" aria-modal="true" aria-label="Record subscription">
          <ModalHeader title="Record subscription" onClose={() => !busy && setDialog(null)} />
          <p className="text-sm text-gray-800">{selected?.name}: {model(planCode)}, starting now.</p>
          <p className="mt-3 text-sm font-medium text-amber-900">Manual record. No payment is taken or verified.</p>
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" className={SECONDARY} onClick={() => setDialog(null)} disabled={busy}>Cancel</button>
            <button type="button" className={PRIMARY} onClick={record} disabled={busy}>{busy ? 'Saving…' : 'Record'}</button>
          </div>
        </div>
      </Modal>

      <Modal open={dialog === 'end'} onClose={() => !busy && setDialog(null)} className="max-w-md">
        <div role="dialog" aria-modal="true" aria-label="End subscription">
          <ModalHeader title="End subscription" onClose={() => !busy && setDialog(null)} />
          <p className="text-sm text-gray-800">{selected?.name}: {model(current?.planCode)}.</p>
          <p className="mt-3 text-xs text-gray-600">Ended subscriptions are kept in the history and can't be changed.</p>
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" className={SECONDARY} onClick={() => setDialog(null)} disabled={busy}>Cancel</button>
            <button type="button" className={PRIMARY} onClick={end} disabled={busy}>{busy ? 'Ending…' : 'End subscription'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
