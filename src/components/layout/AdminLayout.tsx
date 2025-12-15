import { PropsWithChildren, useState } from "react";
import {Link, Outlet, useLocation} from "react-router-dom";

const NAV_ITEMS = [
  { label: "Menus", path: "admin/menus" },
  // Future items can be added here
];

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { pathname } = useLocation();
  const tenantSlug = pathname.split("/")[1]; // crude extract

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Mobile top bar */}
      <button className="md:hidden absolute top-4 left-4 z-50 text-gray-700" onClick={() => setSidebarOpen(!sidebarOpen)}>
        ☰
      </button>
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 transform bg-gray-50 border-r border-gray-200 px-6 py-8 transition-transform duration-200 md:static md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <h1 className="text-xl font-bold mb-6">Admin</h1>
        <nav className="space-y-2">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.path}
              to={`/${tenantSlug}/${item.path}`}
              className={`block px-3 py-2 rounded-lg hover:bg-gray-100 ${pathname.includes(item.path) ? "bg-gray-100 font-medium" : ""}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1">
        <header className="border-b border-gray-200 bg-white h-14 flex items-center px-6">
          {/* breadcrumb placeholder */}
          <span className="text-sm text-gray-500">{pathname}</span>
        </header>
        <div className="max-w-6xl mx-auto px-4 py-6">
            <Outlet />
        </div>
      </main>
    </div>
  );
}