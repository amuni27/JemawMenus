import { useEffect, useState } from 'react';
import { adminApi, type AdminAuditPage } from '../../api/adminApi';
import { errorMessage } from '../../utils/errorMessage';

// AGF E4-M1: read-only audit log, newest first, 25 per page.

const SIZE = 25;

export default function SuperAdminAuditLog() {
  const [page, setPage] = useState(0);
  const [data, setData] = useState<AdminAuditPage | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    adminApi.auditEvents(page, SIZE).then(
      (res) => alive && setData(res.data),
      (err) => alive && setError(errorMessage(err, "Couldn't load the audit log."))
    );
    return () => { alive = false; };
  }, [page]);

  const lastPage = data ? Math.max(0, Math.ceil(data.total / SIZE) - 1) : 0;

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <h1 className="text-xl font-bold text-gray-900">Audit log</h1>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      {!error && !data && <p className="mt-3 text-sm text-gray-500">Loading…</p>}
      {data && data.items.length === 0 && <p className="mt-3 text-sm text-gray-600">No audit events yet.</p>}
      {data && data.items.length > 0 && (
        <>
          {/* focusable, so keyboard users can scroll the table sideways on narrow screens (axe scrollable-region-focusable) */}
          <div role="region" aria-label="Audit log table (scrolls sideways)" tabIndex={0}
               className="mt-4 overflow-x-auto rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900">
            <table aria-label="Audit log" className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b text-gray-600">
                  <th scope="col" className="py-2 pr-4 font-semibold">Time</th>
                  <th scope="col" className="py-2 pr-4 font-semibold">Actor</th>
                  <th scope="col" className="py-2 pr-4 font-semibold">Action</th>
                  <th scope="col" className="py-2 pr-4 font-semibold">Outcome</th>
                  <th scope="col" className="py-2 pr-4 font-semibold">Detail</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((e) => (
                  <tr key={e.id} className="border-b last:border-0">
                    <td className="py-2 pr-4 whitespace-nowrap">{new Date(e.occurredAt).toLocaleString()}</td>
                    <td className="py-2 pr-4">{e.actorLabel}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{e.action}</td>
                    <td className={`py-2 pr-4 ${e.outcome === 'FAILURE' ? 'text-red-700' : 'text-emerald-700'}`}>{e.outcome}</td>
                    <td className="py-2 pr-4 text-gray-600">{e.detail ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm">
            <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)}
                    className="rounded-lg border px-3 py-1.5 disabled:opacity-50">Newer</button>
            <span className="text-gray-600">Page {page + 1} of {lastPage + 1}</span>
            <button type="button" disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)}
                    className="rounded-lg border px-3 py-1.5 disabled:opacity-50">Older</button>
          </div>
        </>
      )}
    </section>
  );
}
