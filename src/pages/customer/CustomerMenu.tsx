import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { usePublicBusinessMenu } from "../../features/menu/hooks/usePublicBusinessMenu";

import { MenuHeader } from "../../components/menu/MenuHeader";
import { MenuSidebar } from "../../components/menu/MenuSidebar";
import { MobileDrawer } from "../../components/menu/MobileDrawer";
import { CategorySection } from "../../components/menu/CategorySection";

export default function CustomerMenu() {
    const { tenantSlug } = useParams<{ tenantSlug: string }>();

    const { business, menus, loading, error } = usePublicBusinessMenu(tenantSlug);

    const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
    const [activeCategoryId, setActiveCategoryId] = useState<string | "ALL">("ALL");
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // pick first menu by default
    useEffect(() => {
        if (!menus?.length) return;
        setActiveMenuId((prev) => prev ?? menus[0].id);
    }, [menus]);

    const activeMenu = useMemo(
        () => menus?.find((m: any) => m.id === activeMenuId) ?? null,
        [menus, activeMenuId]
    );

    // when menu changes -> reset category
    useEffect(() => {
        setActiveCategoryId("ALL");
    }, [activeMenuId]);

    const sortedCategories = useMemo(() => {
        if (!activeMenu) return [];
        const cats = activeMenu.categories ?? [];
        return [...cats].sort((a: any, b: any) => {
            const so = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
            if (so !== 0) return so;
            return (a.name ?? "").localeCompare(b.name ?? "");
        });
    }, [activeMenu]);

    const groups = useMemo(() => {
        if (!activeMenu) return [];
        return sortedCategories.map((cat: any) => {
            const items = (cat.items ?? []).filter((i: any) => i.status === "AVAILABLE");
            return { category: cat, items };
        });
    }, [activeMenu, sortedCategories]);

    const visibleGroups = useMemo(() => {
        if (activeCategoryId === "ALL") return groups;
        return groups.filter((g: any) => g.category.id === activeCategoryId);
    }, [groups, activeCategoryId]);

    function handleSelectMenu(menuId: string) {
        setActiveMenuId(menuId);
        setSidebarOpen(false);
    }

    return (
        <div className="min-h-screen bg-white">
            <MenuHeader
                businessName={business?.name}
                activeMenuDescription={activeMenu?.description}
                activeMenuCurrency={activeMenu?.currency}
                categories={sortedCategories}
                activeCategoryId={activeCategoryId}
                onChangeCategory={setActiveCategoryId}
                onOpenDrawer={() => setSidebarOpen(true)}
            />

            <MobileDrawer open={sidebarOpen} onClose={() => setSidebarOpen(false)} title="Menus">
                <MenuSidebar
                    menus={menus ?? []}
                    activeMenuId={activeMenuId}
                    onSelectMenu={handleSelectMenu}
                    loading={loading}
                />
            </MobileDrawer>

            {loading ? (
                <div className="mx-auto max-w-7xl px-6 py-10 text-gray-600">Loading menu...</div>
            ) : error ? (
                <div className="mx-auto max-w-7xl px-6 py-10">
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
                        {error}
                    </div>
                </div>
            ) : null}

            <div className="mx-auto max-w-7xl px-6 py-10">
                <div className="grid grid-cols-1 gap-8 md:grid-cols-[240px_1fr]">
                    <aside className="sticky top-6 hidden h-fit rounded-2xl border border-gray-200 bg-white p-4 shadow-sm md:block">
                        <MenuSidebar
                            menus={menus ?? []}
                            activeMenuId={activeMenuId}
                            onSelectMenu={handleSelectMenu}
                            loading={loading}
                        />
                    </aside>

                    <main>
                        {!activeMenu ? (
                            <div className="text-gray-600">Select a menu.</div>
                        ) : (
                            <>
                                {visibleGroups.map((g: any) => (
                                    <CategorySection
                                        key={g.category.id}
                                        category={g.category}
                                        items={g.items}
                                    />
                                ))}
                            </>
                        )}
                    </main>
                </div>
            </div>
        </div>
    );
}
