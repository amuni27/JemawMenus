import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { usePublicBusinessMenu } from "../../features/menu/hooks/usePublicBusinessMenu"; // adjust path

function clsx(...xs: Array<string | false | null | undefined>) {
    return xs.filter(Boolean).join(" ");
}

// ---- Small UI helpers ----
function CategoryTab({
                         active,
                         label,
                         onClick,
                     }: {
    active: boolean;
    label: string;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={clsx(
                "rounded-full px-4 py-2 text-sm font-semibold transition",
                active
                    ? "bg-emerald-700 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            )}
        >
            {label}
        </button>
    );
}

function IngredientPill({ text }: { text: string }) {
    return (
        <span className="inline-flex items-center rounded-full border border-emerald-700 px-3 py-1 text-xs font-semibold text-emerald-700">
      {text}
    </span>
    );
}

export default function CustomerMenu() {
    const { tenantSlug } = useParams<{ tenantSlug: string }>();

    // ✅ Backend now returns menus -> categories -> items
    const { business, menus, loading, error } = usePublicBusinessMenu(tenantSlug);

    // Selected Menu (sidebar)
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

    // Selected Category (top tabs)
    const [activeCategoryId, setActiveCategoryId] = useState<string | "ALL">("ALL");

    // When menus load, pick the first menu by default
    useEffect(() => {
        if (!menus?.length) return;
        setActiveMenuId((prev) => prev ?? menus[0].id);
    }, [menus]);

    const activeMenu = useMemo(
        () => menus?.find((m: any) => m.id === activeMenuId) ?? null,
        [menus, activeMenuId]
    );

    // When menu changes, reset category to ALL
    useEffect(() => {
        setActiveCategoryId("ALL");
    }, [activeMenuId]);

    // Sort categories by sortOrder then name
    const sortedCategories = useMemo(() => {
        if (!activeMenu) return [];
        const cats = activeMenu.categories ?? [];
        return [...cats].sort((a: any, b: any) => {
            const so = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
            if (so !== 0) return so;
            return (a.name ?? "").localeCompare(b.name ?? "");
        });
    }, [activeMenu]);

    // ✅ Build groups DIRECTLY from nested response: category.items
    const groups = useMemo(() => {
        if (!activeMenu) return [];

        return sortedCategories.map((cat: any) => {
            const items = (cat.items ?? []).filter((i: any) => i.status === "AVAILABLE");
            return { category: cat, items };
        });
    }, [activeMenu, sortedCategories]);

    // If top tab selects a category, show only that group, else show all
    const visibleGroups = useMemo(() => {
        if (activeCategoryId === "ALL") return groups;
        return groups.filter((g: any) => g.category.id === activeCategoryId);
    }, [groups, activeCategoryId]);

    return (
        <div className="min-h-screen bg-white">
            {/* Header */}
            <header className="border-b bg-white">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
                    <div>
                        <div className="text-2xl font-extrabold text-gray-900">
                            {business?.name ?? "Menu"}
                        </div>
                        {activeMenu?.description ? (
                            <div className="mt-1 text-sm text-gray-500">{activeMenu.description}</div>
                        ) : null}
                    </div>

                    {/* optional: show currency */}
                    {activeMenu?.currency ? (
                        <div className="text-sm font-semibold text-gray-600">
                            Currency: <span className="text-gray-900">{activeMenu.currency}</span>
                        </div>
                    ) : null}
                </div>

                {/* Category Tabs */}
                <div className="mx-auto max-w-7xl px-6 pb-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <CategoryTab
                            active={activeCategoryId === "ALL"}
                            label="All"
                            onClick={() => setActiveCategoryId("ALL")}
                        />
                        {sortedCategories.map((c: any) => (
                            <CategoryTab
                                key={c.id}
                                active={activeCategoryId === c.id}
                                label={c.name}
                                onClick={() => setActiveCategoryId(c.id)}
                            />
                        ))}
                    </div>
                </div>
            </header>

            {/* Loading / Error */}
            {loading ? (
                <div className="mx-auto max-w-7xl px-6 py-10 text-gray-600">Loading menu...</div>
            ) : error ? (
                <div className="mx-auto max-w-7xl px-6 py-10">
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
                        {error}
                    </div>
                </div>
            ) : null}

            {/* Body */}
            <div className="mx-auto grid max-w-7xl grid-cols-[240px_1fr] gap-8 px-6 py-10">
                {/* Left sidebar: MENUS */}
                <aside className="sticky top-6 h-fit rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-500">
                        Menus
                    </div>

                    <div className="space-y-2">
                        {menus?.map((m: any) => {
                            const active = m.id === activeMenuId;
                            return (
                                <button
                                    key={m.id}
                                    onClick={() => setActiveMenuId(m.id)}
                                    className={clsx(
                                        "w-full rounded-xl px-3 py-3 text-left transition",
                                        active
                                            ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
                                            : "hover:bg-gray-50"
                                    )}
                                >
                                    <div className="font-semibold">{m.name}</div>
                                    {m.description ? (
                                        <div className="mt-1 text-xs text-gray-500">{m.description}</div>
                                    ) : null}
                                </button>
                            );
                        })}

                        {!menus?.length && !loading ? (
                            <div className="text-sm text-gray-500">No menus found.</div>
                        ) : null}
                    </div>
                </aside>

                {/* Main */}
                <main>
                    {!activeMenu ? (
                        <div className="text-gray-600">Select a menu.</div>
                    ) : (
                        <>
                            {visibleGroups.map((group: any) => (
                                <section key={group.category.id} className="mb-12">
                                    <div className="mb-5 flex items-end justify-between">
                                        <h2 className="text-2xl font-extrabold tracking-tight text-gray-900">
                                            {group.category.name}
                                        </h2>
                                        <div className="text-sm text-gray-500">
                                            {group.items.length} item{group.items.length === 1 ? "" : "s"}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
                                        {group.items.map((item: any) => (
                                            <article
                                                key={item.id}
                                                className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm"
                                            >
                                                <div className="relative h-56 overflow-hidden bg-gray-100">
                                                    {item.imageUrl ? (
                                                        <img
                                                            src={item.imageUrl}
                                                            alt={item.name}
                                                            className="
        h-full w-full
        object-cover
        transition-transform duration-300 ease-out
        hover:scale-105
      "
                                                        />
                                                    ) : (
                                                        <div
                                                            className="flex h-full items-center justify-center text-gray-400">
                                                            No image
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="p-6">
                                                    <h3 className="text-xl font-extrabold tracking-tight text-gray-900">
                                                        {item.name}
                                                    </h3>

                                                    {item.description ? (
                                                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-gray-600">
                                                            {item.description}
                                                        </p>
                                                    ) : null}

                                                    <div
                                                        className="mt-3 flex items-center justify-between text-sm text-gray-700">
                            <span className="font-semibold">
                              ${Number(item.price).toFixed(2)}
                            </span>
                                                        {typeof item.calories === "number" ? (
                                                            <span className="text-gray-500">{item.calories} cals</span>
                                                        ) : null}
                                                    </div>

                                                    {item.ingredients?.length ? (
                                                        <div className="mt-5">
                                                            <div className="text-sm font-semibold text-gray-800">
                                                                Ingredients:
                                                            </div>
                                                            <div className="mt-2 flex flex-wrap gap-2">
                                                                {item.ingredients.slice(0, 5).map((ing: string) => (
                                                                    <IngredientPill key={ing} text={ing}/>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            </article>
                                        ))}

                                        {group.items.length === 0 ? (
                                            <div
                                                className="rounded-2xl border border-dashed border-gray-300 p-6 text-sm text-gray-500">
                                                No items available in this category.
                                            </div>
                                        ) : null}
                                    </div>
                                </section>
                            ))}
                        </>
                    )}
                </main>
            </div>
        </div>
    );
}




