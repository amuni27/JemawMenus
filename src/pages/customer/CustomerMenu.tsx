import React, {useEffect, useMemo, useState} from "react";
import {useParams} from "react-router-dom";
import {usePublicBusinessMenu} from "../../features/menu/hooks/usePublicBusinessMenu";

import {MenuHeader} from "../../components/menu/MenuHeader";
import {MenuSidebar} from "../../components/menu/MenuSidebar";
import {MobileDrawer} from "../../components/menu/MobileDrawer";
import {CategorySection} from "../../components/menu/CategorySection";
import {CategoryTab} from "../../components/menu/CategoryTab.tsx";

export default function CustomerMenu() {
    const {tenantSlug} = useParams<{ tenantSlug: string }>();
    const {business, menus, loading, error} = usePublicBusinessMenu(tenantSlug);
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
            return {category: cat, items};
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
        <div className=" bg-white">
            <MenuHeader
                businessName={business?.name}
                activeMenuCurrency={activeMenu?.currency}
                menus={menus}
                activeMenuId={activeMenuId}
                handleSelectMenu={handleSelectMenu}
                loading={loading}
            />

            {loading ? (
                <div className="mx-auto max-w-7xl px-6 py-10 text-gray-600">Loading menu...</div>
            ) : error ? (
                <div className="mx-auto max-w-7xl px-6 py-10">
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
                        {error}
                    </div>
                </div>
            ) : null}

            <div className="mx-auto px-4 sm:px-6 py-8 sm:py-10 flex justify-center">
                <div className="w-full max-w-4xl">
                    <div className="flex flex-wrap items-center gap-2 mb-6">
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
                                        currency={activeMenu?.currency}
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
