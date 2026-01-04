import React, { useEffect, useMemo, useRef, useState } from "react";

type Menu = { id: string; name: string };

type Props = {
    menus: Menu[];
    activeMenuId: string | null;
    onSelectMenu: (menuId: string) => void;
    loading?: boolean;
    onSearch?: (q: string) => void; // optional hook
};

export function MenuPicker({
                               menus,
                               activeMenuId,
                               onSelectMenu,
                               loading,
                               onSearch,
                           }: Props) {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState("");
    const searchRef = useRef<HTMLInputElement | null>(null);

    const activeMenu = useMemo(() => {
        return menus?.find((m) => m.id === activeMenuId) ?? menus?.[0] ?? null;
    }, [menus, activeMenuId]);

    const filtered = useMemo(() => {
        const term = q.trim().toLowerCase();
        if (!term) return menus;
        return menus.filter((m) => m.name.toLowerCase().includes(term));
    }, [menus, q]);

    useEffect(() => {
        if (!open) return;
        // focus search input when sheet opens (mobile)
        setTimeout(() => searchRef.current?.focus(), 0);
    }, [open]);

    const handlePick = (id: string) => {
        onSelectMenu(id);
        setOpen(false);
        setQ("");
    };

    const handleSearchChange = (val: string) => {
        setQ(val);
        onSearch?.(val);
    };

    return (
        <>
            {/* Top bar container */}
            <div className="w-full">
                <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-1 sm:justify-between sm:gap-3 sm:px-6">
                    {/* Mobile Search icon (visible on < sm) - FIRST on mobile */}
                    <button
                        type="button"
                        onClick={() => setOpen(true)} // open sheet and search inside rounded-full border border-gray-200 bg-white shadow-sm
                        className="order-1 sm:hidden inline-flex h-10 w-10 items-center justify-center  transition hover:bg-gray-50 active:scale-[0.99]"
                        aria-label="Search menu"
                    >
                        <SearchIcon className="h-5 w-5 text-gray-700" />
                    </button>

                    {/* Menu Selector - SECOND on mobile, FIRST on desktop */}
                    <button
                        type="button"
                        onClick={() => setOpen(true)} //rounded-full border border-gray-200 shadow-sm
                        className="order-2 sm:order-1 group inline-flex min-w-0 items-center gap-2  bg-white px-4 py-2  transition hover:bg-gray-50 active:scale-[0.99]"
                        aria-label="Select menu category"
                    >
                        {/* small dot like modern UI */}
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
                        <span className="truncate text-sm font-semibold text-gray-900">
              {activeMenu?.name ?? (loading ? "Loading..." : "Select menu")}
            </span>
                        <ChevronDownIcon className="h-4 w-4 shrink-0 text-gray-500 transition group-hover:text-gray-700" />
                    </button>

                    {/* Desktop search input (visible on >= sm) */}
                    <div className="order-2 hidden flex-1 sm:block">
                        <div className="relative">
                            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                            <input
                                value={q}
                                onChange={(e) => handleSearchChange(e.target.value)}
                                placeholder="Search menu items…"
                                className="w-full rounded-full border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 shadow-sm outline-none transition focus:border-gray-300 focus:ring-2 focus:ring-emerald-100"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile/Universal Sheet */}
            {open && (
                <div className="fixed inset-0 z-50">
                    {/* backdrop */}
                    <button
                        className="absolute inset-0 bg-black/30"
                        aria-label="Close"
                        onClick={() => setOpen(false)}
                    />

                    {/* sheet */}
                    <div className="absolute bottom-0 left-0 right-0 mx-auto w-full max-w-2xl rounded-t-3xl bg-white shadow-2xl">
                        <div className="px-4 pb-4 pt-3 sm:px-6">
                            {/* grab handle */}
                            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-gray-200" />

                            {/* header row */}
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <div className="text-base font-bold text-gray-900">Full Menu</div>
                                    <div className="text-xs text-gray-500">Choose a category</div>
                                </div>

                                <button
                                    onClick={() => setOpen(false)}
                                    className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-gray-100"
                                    aria-label="Close"
                                >
                                    <XIcon className="h-5 w-5 text-gray-700" />
                                </button>
                            </div>

                            {/* search inside sheet (mobile UX like DoorDash) */}
                            <div className="mt-3">
                                <div className="relative">
                                    <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                                    <input
                                        ref={searchRef}
                                        value={q}
                                        onChange={(e) => handleSearchChange(e.target.value)}
                                        placeholder="Search categories…"
                                        className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-3 text-sm text-gray-900 outline-none focus:border-gray-300 focus:ring-2 focus:ring-emerald-100"
                                    />
                                </div>
                            </div>

                            {/* menu list */}
                            <div className="mt-3 max-h-[55vh] overflow-auto pr-1">
                                {!menus?.length && !loading ? (
                                    <div className="rounded-2xl border border-dashed border-gray-200 p-4 text-sm text-gray-500">
                                        No menus found.
                                    </div>
                                ) : null}

                                {filtered?.map((m) => {
                                    const active = m.id === (activeMenuId ?? activeMenu?.id);
                                    return (
                                        <button
                                            key={m.id}
                                            onClick={() => handlePick(m.id)}
                                            className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition ${
                                                active
                                                    ? "bg-emerald-50 ring-1 ring-emerald-200"
                                                    : "hover:bg-gray-50"
                                            }`}
                                        >
                                            <div className="min-w-0">
                                                <div className="truncate text-sm font-semibold text-gray-900">
                                                    {m.name}
                                                </div>
                                            </div>

                                            {active ? (
                                                <CheckIcon className="h-5 w-5 text-emerald-700" />
                                            ) : (
                                                <span className="text-xs text-gray-400">Select</span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

/* ---------- tiny inline icons (no library needed) ---------- */
function ChevronDownIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 20 20" fill="currentColor" {...props}>
            <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.24 4.5a.75.75 0 0 1-1.08 0l-4.24-4.5a.75.75 0 0 1 .02-1.06Z"
                clipRule="evenodd"
            />
        </svg>
    );
}

function SearchIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 20 20" fill="currentColor" {...props}>
            <path
                fillRule="evenodd"
                d="M9 3.5a5.5 5.5 0 1 0 3.47 9.77l3.13 3.13a.75.75 0 1 0 1.06-1.06l-3.13-3.13A5.5 5.5 0 0 0 9 3.5Zm-4 5.5a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z"
                clipRule="evenodd"
            />
        </svg>
    );
}

function XIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 20 20" fill="currentColor" {...props}>
            <path
                fillRule="evenodd"
                d="M5.22 5.22a.75.75 0 0 1 1.06 0L10 8.94l3.72-3.72a.75.75 0 1 1 1.06 1.06L11.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06L10 11.06l-3.72 3.72a.75.75 0 1 1-1.06-1.06L8.94 10 5.22 6.28a.75.75 0 0 1 0-1.06Z"
                clipRule="evenodd"
            />
        </svg>
    );
}

function CheckIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 20 20" fill="currentColor" {...props}>
            <path
                fillRule="evenodd"
                d="M16.7 5.29a.75.75 0 0 1 0 1.06l-7.5 7.5a.75.75 0 0 1-1.06 0l-3.5-3.5a.75.75 0 1 1 1.06-1.06l2.97 2.97 6.97-6.97a.75.75 0 0 1 1.06 0Z"
                clipRule="evenodd"
            />
        </svg>
    );
}
