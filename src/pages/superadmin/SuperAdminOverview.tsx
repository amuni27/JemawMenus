import { useOutletContext } from 'react-router-dom';
import type { AdminSummary } from '../../api/adminApi';

// AGF E4-M1: the console's start page. Monetization settings arrive with E4-M2; nothing to configure yet.

export default function SuperAdminOverview() {
  const admin = useOutletContext<AdminSummary>();
  return (
    <section aria-labelledby="sa-overview" className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <h1 id="sa-overview" className="text-xl font-bold text-gray-900">Overview</h1>
      <p className="mt-2 text-sm text-gray-700">Signed in as {admin?.email}.</p>
      <p className="mt-1 text-sm text-gray-600">Important admin actions are recorded in the audit log.</p>
    </section>
  );
}
