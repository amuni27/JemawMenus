import React, { useEffect, useMemo, useRef, useState } from "react";
import { Outlet, useParams } from "react-router-dom";
import { usePublicBusinessMenu } from "../../hooks/usePublicBusinessMenu";

import { MenuHeader } from "../../components/menu/MenuHeader";
import GuestInfoPanel from "../../components/menu/GuestInfoPanel";
import { CategorySection } from "../../components/menu/CategorySection";
import { CategoryTab } from "../../components/menu/CategoryTab.tsx";
import {useStorageState} from "../../hooks/useStorageState.ts";
import {GuestMenuOutletContext, WaiterListEntry, WaiterListMap} from "../../types/menu.ts";
import {WaiterListDrawer} from "./WaiterListDrawer.tsx";
import { useToast } from "../../components/ui/ToastContext.tsx";
import { isGuestVisible, isSoldOut } from "../../utils/itemAvailability.ts";
import { itemMatches, normalizeSearch, type Searchable } from "../../utils/menuSearch.ts";


export default function CustomerMenu() {
const { tenantSlug, itemId } = useParams<{ tenantSlug: string; itemId?: string }>();
    const isViewingItem = Boolean(itemId);
    const { business, menus, loading, error } = usePublicBusinessMenu(tenantSlug);
    const toast = useToast();
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
    const [activeCategoryId, setActiveCategoryId] = useState<string | "ALL">("ALL");
    // AGF-S2-05: item search within the active menu
    const [searchQuery, setSearchQuery] = useState("");
    const searching = normalizeSearch(searchQuery) !== "";

    // refs for scroll-sync
    const tabsBarRef = useRef<HTMLDivElement | null>(null);
    const stickyBarRef = useRef<HTMLDivElement | null>(null);
    const topSentinelRef = useRef<HTMLDivElement | null>(null);
    const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const isProgrammaticScroll = useRef(false);

    const WAITER_LIST_STORAGE_KEY = `waiter_list:${tenantSlug ?? "unknown"}`;
    const [waiterList, setWaiterList] = useStorageState<WaiterListMap>(
        WAITER_LIST_STORAGE_KEY,
        {},
        "session"
    );

    const [isWaiterListOpen, setIsWaiterListOpen] = useState(false);

    const waiterListItemCount = useMemo(() => {
        return Object.values(waiterList).reduce((sum, e) => sum + e.quantity, 0);
    }, [waiterList]);

    function openWaiterList() {
        setIsWaiterListOpen(true);
    }

    function closeWaiterList() {
        setIsWaiterListOpen(false);
    }

    // Items currently sold out anywhere on this business's menus (AGF-S1-13)
    const soldOutItemIds = useMemo(() => {
        const ids = new Set<string>();
        type GuestMenu = { categories?: { items?: { id: string | number; status?: string }[] }[] };
        for (const menu of (menus ?? []) as GuestMenu[])
            for (const cat of menu.categories ?? [])
                for (const i of cat.items ?? [])
                    if (isSoldOut(i.status)) ids.add(String(i.id));
        return ids;
    }, [menus]);

    function addMenuItemToWaiterList(menuItem: any) {
        if (isSoldOut(menuItem.status)) return; // sold-out items cannot be added
        const itemId = String(menuItem.id);

        // snapshot: keep it small + stable
        const snapshot = {
            name: String(menuItem.name ?? "Unnamed item"),
            imageUrl: menuItem.imageUrl ? String(menuItem.imageUrl) : undefined,
            price:
                typeof menuItem.price === "number" || typeof menuItem.price === "string"
                    ? Number(menuItem.price)
                    : undefined,
            currency: menuItem.currency ?? activeMenu?.currency, // item detail carries its own currency (S2-02)
        };

        setWaiterList((prev) => {
            const existing = prev[itemId];

            const next: WaiterListEntry = existing
                ? {
                    ...existing,
                    quantity: existing.quantity + 1,
                    // keep existing snapshot OR update it (choose one).
                    // I recommend keeping existing snapshot for stability:
                    snapshot: existing.snapshot,
                }
                : {
                    itemId,
                    quantity: 1,
                    snapshot,
                };

            return { ...prev, [itemId]: next };
        });
        toast(`Added: ${menuItem.name ?? "Item"}`);
    }

    function incrementWaiterListItem(itemId: string) {
        if (soldOutItemIds.has(itemId)) return; // entry stays, but cannot be increased while sold out
        setWaiterList((prev) => {
            const existing = prev[itemId];
            if (!existing) return prev;
            return {
                ...prev,
                [itemId]: { ...existing, quantity: existing.quantity + 1 },
            };
        });
    }

    function decrementWaiterListItem(itemId: string) {
        setWaiterList((prev) => {
            const existing = prev[itemId];
            if (!existing) return prev;

            if (existing.quantity <= 1) {
                const { [itemId]: _, ...rest } = prev;
                return rest;
            }

            return {
                ...prev,
                [itemId]: { ...existing, quantity: existing.quantity - 1 },
            };
        });
    }

    function removeWaiterListItem(itemId: string) {
        setWaiterList((prev) => {
            const { [itemId]: _, ...rest } = prev;
            return rest;
        });
    }

    function clearWaiterList() {
        setWaiterList({});
    }

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
        // The owner's saved order (AGF-S2-07). Equal positions keep the API's order (it breaks ties
        // by creation time, like the owner list) instead of being re-sorted by name.
        return [...cats].sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    }, [activeMenu]);

    const groups = useMemo(() => {
        if (!activeMenu) return [];
        return sortedCategories.map((cat: any) => {
            // AVAILABLE and OUT_OF_STOCK are shown (sold-out counted, PO-8); anything else stays hidden
            const items = (cat.items ?? []).filter((i: any) => isGuestVisible(i.status));
            return { category: cat, items };
        });
    }, [activeMenu, sortedCategories]);

    // While searching: only matching items, and only categories that still have some (AGF-S2-05)
    const displayedGroups = useMemo(() => {
        if (!searching) return groups;
        return groups
            .map((g) => ({ ...g, items: g.items.filter((i: Searchable) => itemMatches(i, searchQuery)) }))
            .filter((g) => g.items.length > 0);
    }, [groups, searching, searchQuery]);

    const tabCategories = searching ? displayedGroups.map((g) => g.category) : sortedCategories;

    function handleSearchChange(q: string) {
        setSearchQuery(q);
        setActiveCategoryId("ALL");
    }

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
      if (isViewingItem) return;
        const bar = tabsBarRef.current;
        if (!bar) return;

        const el = bar.querySelector<HTMLElement>(`[data-cat-tab="${activeCategoryId}"]`);
        if (!el) return;

        el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });

    }, [activeCategoryId, isViewingItem]);

    // IntersectionObserver: update active category as user scrolls the menu list
    useEffect(() => {
        if (!displayedGroups.length) return;
        if (isViewingItem) return;

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
    }, [displayedGroups]);

    return (
        <div className="bg-white">
            <MenuHeader
                businessName={business?.name}
                logoUrl={business?.logoUrl ?? undefined}
                activeMenuCurrency={activeMenu?.currency}
                menus={menus}
                activeMenuId={activeMenuId}
                handleSelectMenu={handleSelectMenu}
                loading={loading}
                orderCount={waiterListItemCount}
                onOpenOrder={openWaiterList}
                searchQuery={searchQuery}
                onSearchChange={handleSearchChange}
            />

            {/* AGF-S2-03: open now, today's hours, phone and address */}
            {business && <GuestInfoPanel business={business} />}

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
                     {!isViewingItem && (
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

                            {tabCategories.map((c: any) => (
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
                    )}
                    <main className="pt-4">
                        {!activeMenu ? (
                            // PO-2: a restaurant with no published, public menu yet (AGF-S1-15)
                            loading || error ? null : menus.length === 0 ? (
                                <div className="py-10 text-center text-gray-600">Menu coming soon</div>
                            ) : (
                                <div className="text-gray-600">Select a menu.</div>
                            )
                        ) : isViewingItem ? (
                            // ✅ REPLACE cards with item detail
                            <div className="">
                                <Outlet context={{ addToWaiterList: addMenuItemToWaiterList } satisfies GuestMenuOutletContext} />
                            </div>
                         ) : (
                            <>
                                {searching && displayedGroups.length === 0 && (
                                    <div className="py-12 text-center">
                                        <p className="text-base font-semibold text-gray-900">No items match "{searchQuery.trim()}"</p>
                                        <p className="mt-1 text-sm text-gray-500">Try another word, or check the other menus.</p>
                                        <button
                                            type="button"
                                            onClick={() => handleSearchChange("")}
                                            className="mt-4 inline-flex items-center rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 shadow-sm hover:bg-gray-50"
                                        >
                                            Clear search
                                        </button>
                                    </div>
                                )}
                                {displayedGroups.map((g: any) => (
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
                                            onAddItem={addMenuItemToWaiterList}
                                        />
                                    </div>
                                ))}
                            </>
                        )}
                    </main>
                </div>
            </div>
            <WaiterListDrawer
                open={isWaiterListOpen}
                onClose={closeWaiterList}
                waiterList={waiterList}
                soldOutItemIds={soldOutItemIds}
                onIncrement={incrementWaiterListItem}
                onDecrement={decrementWaiterListItem}
                onRemove={removeWaiterListItem}
                onClear={clearWaiterList}
            />
        </div>
    );
}
