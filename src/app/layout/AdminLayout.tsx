import { Outlet, useParams, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import SidebarNavItem from '../../components/admin/SidebarNavItem';
import PlanUsageCard from '../../components/admin/PlanUsageCard';
import TopHeader from '../../components/admin/TopHeader';
import clsx from 'clsx';

export default function AdminLayout() {
  const { tenantSlug } = useParams();
  const { user, business, isAuthenticated,logout } = useAuth();

  const base = `/${tenantSlug}/admin`;

  const qrLinks = [
    { to: `${base}/qr`, label: 'All', exact: true },
    { to: `${base}/qr?status=ACTIVE`, label: 'Active' },
    { to: `${base}/qr?status=PAUSED`, label: 'Paused' },
    { to: `${base}/qr?status=TRASH`, label: 'Trash' },
  ];

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="flex h-screen w-[260px] flex-col border-r border-gray-200 bg-white p-4 fixed inset-y-0 left-0 z-30">
        <div className="mb-4">
          {/* Tenant switcher placeholder */}
          <button className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm font-medium">
            {business?.name ?? 'Workspace'}
            <span className="text-gray-500">▾</span>
          </button>
        </div>

        <div className="mb-2 text-xs font-semibold text-gray-500 px-2">QR CODES</div>
        <nav className="flex flex-col gap-1 mb-4">
          {qrLinks.map((l) => (
            <SidebarNavItem key={l.to} {...l} />
          ))}
        </nav>

        <div className="mb-2 text-xs font-semibold text-gray-500 px-2">PROJECTS</div>
        <SidebarNavItem to={`${base}/menu`} label="Menus" />
        <button className="mt-2 w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
          Create menu
        </button>

        <div className="mt-auto flex flex-col gap-4">
          <PlanUsageCard used={1} limit={2} />
          <button className="text-left text-sm text-gray-700 hover:underline" onClick={logout}>
            Log out
          </button>
          <div className="rounded-lg bg-gray-100 p-3 text-xs">
            <div className="font-medium">{user?.name ?? 'User'}</div>
            <div className="text-gray-600">{user?.email}</div>
          </div>
        </div>
      </aside>

      {/* Main column offset */}
      <div className="ml-[260px] flex min-h-screen flex-1 flex-col">
        <TopHeader createLabel="+ Create QR" />
        <div className="p-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
