import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { usePublicBusinessMenu } from "../../features/menu/hooks/usePublicBusinessMenu";

import { MenuHeader } from "../../components/menu/MenuHeader";
import { CategorySection } from "../../components/menu/CategorySection";
import { CategoryTab } from "../../components/menu/CategoryTab.tsx";

export default function CustomerMenu() {
    const { tenantSlug } = useParams<{ tenantSlug: string }>();
    const { business, menus, loading, error } = usePublicBusinessMenu(tenantSlug);

    const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
    const [activeCategoryId, setActiveCategoryId] = useState<string | "ALL">("ALL");

    // refs for scroll-sync
    const tabsBarRef = useRef<HTMLDivElement | null>(null);
    const stickyBarRef = useRef<HTMLDivElement | null>(null);
    const topSentinelRef = useRef<HTMLDivElement | null>(null);
    const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const isProgrammaticScroll = useRef(false);

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
        // also scroll to top of list area
        requestAnimationFrame(() => {
            topSentinelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
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

    function handleSelectMenu(menuId: string) {
        setActiveMenuId(menuId);
    }

    function scrollToCategory(catId: string | "ALL") {
        isProgrammaticScroll.current = true;
        setActiveCategoryId(catId);

        requestAnimationFrame(() => {
            const stickyH = stickyBarRef.current?.getBoundingClientRect().height ?? 0;
            const gap = 12; // small breathing room under the tabs

            const target =
                catId === "ALL" ? topSentinelRef.current : sectionRefs.current[catId];

            if (!target) return;

            const y = window.scrollY + target.getBoundingClientRect().top - stickyH - gap;

            window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });

            window.setTimeout(() => {
                isProgrammaticScroll.current = false;
            }, 500);
        });
    }

    // keep the active tab scrolled into view (horizontal)
    useEffect(() => {
        const bar = tabsBarRef.current;
        if (!bar) return;

        const el = bar.querySelector<HTMLElement>(`[data-cat-tab="${activeCategoryId}"]`);
        if (!el) return;

        el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }, [activeCategoryId]);

    // IntersectionObserver: update active category as user scrolls the menu list
    useEffect(() => {
        if (!groups.length) return;

        const stickyH = stickyBarRef.current?.getBoundingClientRect().height ?? 0;

        // We consider a section "active" when its top reaches just under the sticky category bar
        const rootMargin = `-${Math.ceil(stickyH) + 8}px 0px -70% 0px`;

        const observer = new IntersectionObserver(
            (entries) => {
                if (isProgrammaticScroll.current) return;

                // find best candidate near top
                const visible = entries
                    .filter((e) => e.isIntersecting)
                    .sort((a, b) => {
                        // closest to the top wins
                        return Math.abs(a.boundingClientRect.top) - Math.abs(b.boundingClientRect.top);
                    });

                if (!visible.length) return;

                const best = visible[0].target as HTMLElement;
                const catId = best.dataset.catId;

                if (!catId) return;
                setActiveCategoryId(catId as any);
            },
            { root: null, rootMargin, threshold: [0.1, 0.25, 0.5] }
        );

        // observe each category wrapper
        Object.values(sectionRefs.current).forEach((el) => {
            if (el) observer.observe(el);
        });

        // separate observer for top sentinel => activates "ALL"
        const topObs = new IntersectionObserver(
            (entries) => {
                if (isProgrammaticScroll.current) return;
                const hit = entries.some((e) => e.isIntersecting);
                if (hit) setActiveCategoryId("ALL");
            },
            { root: null, rootMargin: `-${Math.ceil(stickyH)}px 0px -85% 0px`, threshold: [0, 0.01, 0.1] }
        );

        if (topSentinelRef.current) topObs.observe(topSentinelRef.current);

        return () => {
            observer.disconnect();
            topObs.disconnect();
        };
    }, [groups]);

    return (
        <div className="bg-white">
            <MenuHeader
                businessName={business?.name}
                logoUrl={"https://static.spotapps.co/website_images/ab_websites/67806_website/logo.png"}
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
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>
                </div>
            ) : null}

            <div className="mx-auto px-4 sm:px-6 py-4 sm:py-10 flex justify-center">
                <div className="w-full max-w-4xl">
                    {/* sentinel for "ALL" (top of the list area) */}
                    <div ref={topSentinelRef}/>

                    {/* Sticky category bar (header scrolls normally, this stays visible) */}
                    <div ref={stickyBarRef} className="sticky top-0 z-20 bg-white border-b border-gray-50 lg:top-[100px]">
                        {/* horizontally scrollable tabs (same UI look, just scrollable) */}
                        <div
                            ref={tabsBarRef}
                            className="flex flex-nowrap items-center gap-2 overflow-x-auto py-2 px-1"
                        >
                            <CategoryTab
                                tabId="ALL"
                                active={activeCategoryId === "ALL"}
                                label="All"
                                onClick={() => scrollToCategory("ALL")}
                            />

                            {sortedCategories.map((c: any) => (
                                <CategoryTab
                                    key={c.id}
                                    tabId={c.id}
                                    active={activeCategoryId === c.id}
                                    label={c.name}
                                    onClick={() => scrollToCategory(c.id)}
                                />
                            ))}
                        </div>
                    </div>

                    <main className="pt-4">
                        {!activeMenu ? (
                            <div className="text-gray-600">Select a menu.</div>
                        ) : (
                            <>
                                {groups.map((g: any) => (
                                    <div
                                        key={g.category.id}
                                        data-cat-id={g.category.id}
                                        ref={(el) => {
                                            sectionRefs.current[g.category.id] = el;
                                        }}
                                    >
                                        <CategorySection
                                            category={g.category}
                                            items={g.items}
                                            currency={activeMenu?.currency}
                                        />
                                    </div>
                                ))}
                            </>
                        )}
                    </main>
                </div>
            </div>
        </div>
    );
}
