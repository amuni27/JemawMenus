import { useEffect, useState } from 'react';
import { NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { ADMIN_TOKEN_KEY, adminApi, type AdminSummary } from '../../api/adminApi';

// AGF E4-M1: the Super Admin console shell. The backend decides (ROLE_ADMIN on every request); without a valid admin
// session the console goes to its own sign-in page. Owner sessions are never read or changed here (SC5).

export default function SuperAdminLayout() {
  const navigate = useNavigate();
  const hasToken = !!localStorage.getItem(ADMIN_TOKEN_KEY);
  const [admin, setAdmin] = useState<AdminSummary | null>(null);
  const [ended, setEnded] = useState(false);

  useEffect(() => {
    if (!hasToken) return;
    let alive = true;
    adminApi.me().then(
      (res) => alive && setAdmin(res.data),
      () => {
        localStorage.removeItem(ADMIN_TOKEN_KEY);
        if (alive) setEnded(true);
      }
    );
    return () => { alive = false; };
  }, [hasToken]);

  if (!hasToken || ended) return <Navigate to="/super-admin/login" replace />;
  if (!admin) return <p role="status" className="p-6 text-gray-500">Checking your admin session…</p>;

  const signOut = () => {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    navigate('/super-admin/login', { replace: true });
  };
  const link = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-gray-200 font-semibold text-gray-900' : 'text-gray-700 hover:bg-gray-100'}`;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white px-6 py-3">
        <p className="text-sm font-bold text-gray-900">Agafari Super Admin</p>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-700">{admin.email}</span>
          <button type="button" onClick={signOut} className="rounded-lg border border-gray-300 px-3 py-1.5 font-medium text-gray-800 hover:bg-gray-100">
            Sign out
          </button>
        </div>
      </header>
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 md:flex-row">
        <nav aria-label="Super Admin" className="flex gap-2 md:w-48 md:flex-col">
          <NavLink to="/super-admin" end className={link}>Overview</NavLink>
          <NavLink to="/super-admin/monetization" className={link}>Monetization</NavLink>
          <NavLink to="/super-admin/subscriptions" className={link}>Subscriptions</NavLink>
          <NavLink to="/super-admin/plan-requests" className={link}>Plan requests</NavLink>
          <NavLink to="/super-admin/audit" className={link}>Audit log</NavLink>
        </nav>
        <main className="min-w-0 flex-1"><Outlet context={admin} /></main>
      </div>
    </div>
  );
}
