import { useCallback, useEffect, useState } from 'react';
import { adminApi, type PlanRequestPage } from '../../api/adminApi';
import { errorMessage } from '../../utils/errorMessage';
import PlanRequestActions from './PlanRequestActions';

// AGF E4-M4: pending owner plan requests. Fulfil records the manual subscription (no payment verified); Decline ends the
// request. Requests whose plan the current configuration no longer enables are flagged and can only be declined.

const SIZE = 20;
const model = (code: string) => `Model ${code.slice(-1)}`;

export default function SuperAdminPlanRequests() {
  const [data, setData] = useState<PlanRequestPage | null>(null);
  const [configVersion, setConfigVersion] = useState(0);
  const [error, setError] = useState('');

  const fetchAll = () => Promise.all([adminApi.planRequests('PENDING', 0, SIZE), adminApi.monetizationConfig()]);
  const load = useCallback(async () => {
    const [list, config] = await fetchAll();
    setData(list.data);
    setConfigVersion(config.data.version ?? 0);
  }, []);

  useEffect(() => {
    let alive = true;
    fetchAll().then(([list, config]) => {
      if (!alive) return;
      setData(list.data);
      setConfigVersion(config.data.version ?? 0);
    }, (err) => alive && setError(errorMessage(err, "Couldn't load the plan requests.")));
    return () => { alive = false; };
  }, []);

  const done = (failure?: unknown) => {
    setError(failure ? errorMessage(failure, "Couldn't save the change.") : '');
    load().catch(() => undefined);
  };

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <h1 className="text-xl font-bold text-gray-900">Plan requests</h1>
      <p className="mt-1 text-sm text-gray-600">Owner requests. Fulfilling records a manual subscription: no payment is taken or verified.</p>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      {!error && !data && <p className="mt-3 text-sm text-gray-500">Loading…</p>}
      {data && data.items.length === 0 && <p className="mt-3 text-sm text-gray-600">No pending plan requests.</p>}
      {data && data.items.length > 0 && (
        <div role="region" aria-label="Plan requests (scrolls sideways)" tabIndex={0}
             className="mt-4 overflow-x-auto rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900">
          <table aria-label="Plan requests" className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b text-gray-600">
                <th scope="col" className="py-2 pr-4 font-semibold">Restaurant</th>
                <th scope="col" className="py-2 pr-4 font-semibold">Plan</th>
                <th scope="col" className="py-2 pr-4 font-semibold">Requested</th>
                <th scope="col" className="py-2 pr-4 font-semibold">Requested by</th>
                <th scope="col" className="py-2 pr-4 font-semibold"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((r) => (
                <tr key={r.id} className="border-b last:border-0 align-top">
                  <td className="py-2 pr-4">{r.businessName}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">
                    {model(r.planCode)}
                    {r.outsideCurrentConfiguration && (
                      <span className="ml-2 rounded bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-900">Outside current configuration</span>
                    )}
                  </td>
                  <td className="py-2 pr-4 whitespace-nowrap">{new Date(r.requestedAt).toLocaleString()}</td>
                  <td className="py-2 pr-4">{r.requestedBy}</td>
                  <td className="py-2 pr-4">
                    <PlanRequestActions request={r} restaurant={r.businessName ?? ''} configVersion={configVersion} onDone={done} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
