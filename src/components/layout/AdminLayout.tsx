import {useEffect, useRef, useState} from "react";
import {Link, Outlet, useLocation} from "react-router-dom";
import {Settings, HelpCircle, User, LogOut} from "lucide-react";
import {useAuth} from "../../app/context/AuthContext.tsx";


const NAV_ITEMS = [
    {label: "Menus", path: "admin/menus"},
    {label: "QR Code", path: "admin/qrcode"},
];

export default function AdminLayout() {
    const auth =  useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const {pathname} = useLocation();
    const tenantSlug = pathname.split("/")[1]; // crude extract
    const [accountOpen, setAccountOpen] = useState(false);
    const accountRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const onClickOutside = (e: MouseEvent) => {
            if (!accountRef.current) return;
            if (!accountRef.current.contains(e.target as Node)) setAccountOpen(false);
        };
        const onEsc = (e: KeyboardEvent) => {
            if (e.key === "Escape") setAccountOpen(false);
        };
        document.addEventListener("mousedown", onClickOutside);
        document.addEventListener("keydown", onEsc);
        return () => {
            document.removeEventListener("mousedown", onClickOutside);
            document.removeEventListener("keydown", onEsc);
        };
    }, []);

    return (
        <div className="flex min-h-screen bg-gray-50">
            {/* Mobile top bar */}
            <button className="md:hidden absolute top-4 left-4 z-50 text-gray-700"
                    onClick={() => setSidebarOpen(!sidebarOpen)}>
                ☰
            </button>

            {/* Backdrop (closes sidebar when clicking outside) */}
            {sidebarOpen && (
                <button
                    type="button"
                    className="fixed inset-0 z-30 bg-black/30 md:hidden"
                    aria-label="Close sidebar"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`flex flex-col fixed inset-y-0 left-0 z-40 w-64 transform bg-gray-50 border-r border-gray-200 px-6 py-8 transition-transform duration-200 md:static md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
                <h1 className="text-xl font-bold mb-6 mt-6 lg:mt-0">Venue</h1>
                <nav className="space-y-2">
                    {NAV_ITEMS.map((item) => (
                        <Link
                            key={item.path}
                            to={`/${tenantSlug}/${item.path}`}
                            onClick={() => setSidebarOpen(false)}
                            className={`block px-3 py-2 rounded-lg hover:bg-gray-100 ${pathname.includes(item.path) ? "bg-gray-100 font-medium" : ""}`}
                        >
                            {item.label}
                        </Link>
                    ))}
                </nav>
                {/* Bottom section */}
                <div className="pt-4 mt-auto">
                    {/* Settings / Help */}
                    <div className="mb-3 space-y-1">
                        <button
                            className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition">
                            <Settings className="h-4 w-4"/>
                            Settings
                        </button>

                        <button
                            className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition">
                            <HelpCircle className="h-4 w-4"/>
                            Help &amp; feedback
                        </button>
                    </div>

                    {/* User card */}
                    <div ref={accountRef} className="relative">
                        <button
                            type="button"
                            onClick={() => setAccountOpen((v) => !v)}
                            className="w-full text-left rounded-2xl border border-gray-200 bg-white p-3 shadow-sm hover:bg-gray-50 transition"
                        >
                            <div className="flex items-center gap-3">
                                <div
                                    className="h-10 w-10 rounded-full bg-pink-600 text-white flex items-center justify-center font-semibold">
                                    A
                                </div>

                                <div className="min-w-0">
                                    <div className="text-sm font-medium text-gray-900 truncate">
                                        {auth.user?.fullName}
                                    </div>
                                    <div className="text-xs text-gray-500 truncate">
                                        {auth.user?.email}
                                    </div>
                                </div>

                                <User className="ml-auto h-4 w-4 text-gray-400"/>
                            </div>
                        </button>

                        {accountOpen && (
                            <div
                                className="absolute bottom-full left-0 mb-2 w-full rounded-2xl border border-gray-200 bg-white shadow-lg overflow-hidden">
                                {/* top identity area */}
                                <div className="px-4 py-3">
                                    <div className="text-sm font-semibold text-gray-900">{auth.user?.fullName}</div>
                                    <div className="text-sm text-gray-500 truncate">{auth.user?.email}</div>
                                </div>

                                <div className="h-px bg-gray-100"/>

                                {/* menu items */}
                                <button
                                    type="button"
                                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition"
                                    onClick={() => {
                                        setAccountOpen(false);
                                    }}
                                >
                                    <User className="h-4 w-4 text-gray-500"/>
                                    Account
                                </button>

                                <button
                                    type="button"
                                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition"
                                    onClick={auth.logout}
                                >
                                    <LogOut className="h-4 w-4 text-gray-500"/>
                                    Sign out
                                </button>
                            </div>
                        )}
                    </div>
                </div>

            </aside>

            {/* Main content */}
            <main className="flex-1">
                <header className="border-b border-gray-200 bg-white h-14 flex items-center px-6">
                    {/* breadcrumb placeholder */}
                    <span className="text-sm text-gray-500 pl-4">{auth.business?.name}</span>
                </header>
                <div className="max-w-6xl mx-auto px-4 py-6">
                    <Outlet/>
                </div>
            </main>
        </div>
    );
}