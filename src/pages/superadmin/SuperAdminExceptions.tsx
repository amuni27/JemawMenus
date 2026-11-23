import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi, type BillingExceptionPage, type BillingExceptionSummary, type ExceptionState } from '../../api/adminApi';
import { errorMessage } from '../../utils/errorMessage';
import { SECONDARY } from './consoleButtons';
import { codeLabel, money, NO_RESTAURANT, statusLabel, when } from './exceptionText';

// AGF EX-F (register §91): billing exceptions that need a person. Unresolved by default, nearest deadline first; an exception
// without a restaurant (a platform exception) says so. The counts are kept apart (F-2). Nothing here moves money.

const SIZE = 20;

export default function SuperAdminExceptions() {
  const [state, setState] = useState<ExceptionState>('UNRESOLVED');
  const [page, setPage] = useState(0);
  const [data, setData] = useState<BillingExceptionPage | null>(null);
  const [summary, setSummary] = useState<BillingExceptionSummary | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    adminApi.exceptions(state, page, SIZE).then((res) => { if (alive) { setData(res.data); setError(''); } },
      (err) => alive && setError(errorMessage(err, "Couldn't load the exceptions.")));
    adminApi.exceptionSummary().then((res) => alive && setSummary(res.data), () => alive && setSummary(null));
    return () => { alive = false; };
  }, [state, page]);

  const pages = data ? Math.max(1, Math.ceil(data.total / SIZE)) : 1;

  return (
    <section className="space-y-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Exceptions</h1>
        <p className="mt-1 text-sm text-gray-600">Payments and checkouts that need a person. Resolving records what happened; nothing here moves money.</p>
      </div>

      {summary && (
        <ul aria-label="Exception counts" className="flex flex-wrap gap-2 text-sm">
          {([['Unresolved', summary.unresolved], ['Open', summary.open], ['Escalated', summary.escalated], ['Automatic handling', summary.autoHandling],
            ['Overdue', summary.overdue]] as const).map(([label, n]) => (
            <li key={label} className="rounded-lg bg-gray-100 px-3 py-1 text-gray-900">{label} <span className="font-semibold">{n}</span></li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2 text-sm">
        <label htmlFor="exception-state" className="font-medium text-gray-900">Show</label>
        <select id="exception-state" value={state} onChange={(e) => { setState(e.target.value as ExceptionState); setPage(0); }}
                className="rounded-lg border border-gray-300 px-2 py-1.5">
          <option value="UNRESOLVED">Unresolved</option>
          <option value="RESOLVED">Resolved</option>
          <option value="ALL">All</option>
        </select>
      </div>

      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {!error && !data && <p className="text-sm text-gray-500">Loading…</p>}
      {data && data.items.length === 0 && (
        <p className="text-sm text-gray-700">{state === 'UNRESOLVED' ? 'No exceptions to review.' : 'No exceptions.'}</p>
      )}
      {data && data.items.length > 0 && (
        <div role="region" aria-label="Exceptions (scrolls sideways)" tabIndex={0}
             className="overflow-x-auto rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900">
          <table aria-label="Exceptions" className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b text-gray-600">
                {['Exception', 'Restaurant', 'Amount', 'Status', 'Due', 'Claimed by'].map((h) => <th key={h} scope="col" className="py-2 pr-4 font-semibold">{h}</th>)}
                <th scope="col" className="py-2 pr-4 font-semibold"><span className="sr-only">Details</span></th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((e) => (
                <tr key={e.id} className="border-b last:border-0 align-top">
                  <td className="py-2 pr-4">{codeLabel(e.code)}</td>
                  <td className="py-2 pr-4">{e.businessId ? (e.businessName ?? e.businessId) : <span className="font-medium text-gray-900">{NO_RESTAURANT}</span>}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">{money(e.amountMinor, e.currency)}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">{statusLabel(e.status)}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">
                    {when(e.dueAt)}
                    {e.overdue && <span className="ml-2 rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-900">Overdue</span>}
                  </td>
                  <td className="py-2 pr-4">{e.claimedBy ?? '—'}</td>
                  <td className="py-2 pr-4">
                    <Link to={`/super-admin/exceptions/${encodeURIComponent(e.id)}`} aria-label={`Open exception: ${codeLabel(e.code)}`}
                          className="font-medium text-gray-900 underline">Open</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && data.total > SIZE && (
        <div className="flex items-center gap-3 text-sm">
          <button type="button" className={SECONDARY} aria-label="Previous page" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</button>
          <span>Page {page + 1} of {pages}</span>
          <button type="button" className={SECONDARY} aria-label="Next page" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      )}
    </section>
  );
}
