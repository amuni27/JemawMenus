import React, { useEffect, useMemo, useRef, useState } from "react";
import { Outlet, useParams } from "react-router-dom";
import { usePublicBusinessMenu } from "../../hooks/usePublicBusinessMenu";

import { MenuHeader } from "../../components/menu/MenuHeader";
import GuestInfoPanel from "../../components/menu/GuestInfoPanel";
import { CategorySection } from "../../components/menu/CategorySection";
import { FeaturedSection, type FeaturedItem } from "../../components/menu/FeaturedSection";
import { DietaryFilters } from "../../components/menu/DietaryFilters";
import NotFound, { StatusCard } from "../../components/NotFound";
import { statusPrimaryClass } from "../../components/statusStyles";
import { CategoryTab } from "../../components/menu/CategoryTab.tsx";
import {useStorageState} from "../../hooks/useStorageState.ts";
import {GuestMenuOutletContext, MenuItem, WaiterListEntry, WaiterListMap} from "../../types/menu.ts";
import {WaiterListDrawer} from "./WaiterListDrawer.tsx";
import { useToast } from "../../components/ui/ToastContext.tsx";
import { isGuestVisible, isSoldOut } from "../../utils/itemAvailability.ts";
import { itemMatches, normalizeSearch, type Searchable } from "../../utils/menuSearch.ts";
import { featuredItems } from "../../utils/featured.ts";
import { availableChips, hasActiveFilters, matchesFilters, NO_FILTERS, type DietaryFilters as Filters, type DietKey, type WithDietaryData } from "../../utils/dietary.ts";


/** AGF-S2-17: owner preview data; when given, the public menu isn't loaded and ordering is off */
type PublicMenuData = ReturnType<typeof usePublicBusinessMenu>;
export type GuestMenuPreview = { business?: PublicMenuData["business"]; menus: PublicMenuData["menus"]; addDisabledLabel: string };

export default function CustomerMenu({ preview }: { preview?: GuestMenuPreview } = {}) {
const { tenantSlug, itemId } = useParams<{ tenantSlug: string; itemId?: string }>();
    const isViewingItem = Boolean(itemId);
    const publicMenu = usePublicBusinessMenu(preview ? undefined : tenantSlug);
    const { business, menus, loading, error } = preview ? { ...preview, loading: false, error: "" } : publicMenu;
    const notFound = !preview && publicMenu.notFound;
    const addDisabledLabel = preview?.addDisabledLabel;
    const toast = useToast();
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
    const [activeCategoryId, setActiveCategoryId] = useState<string | "ALL">("ALL");
    // AGF-S2-05: item search within the active menu
    const [searchQuery, setSearchQuery] = useState("");
    const searching = normalizeSearch(searchQuery) !== "";
    // AGF-S2-14: dietary and allergen filters; page state only (never in the URL), reset when the menu changes
    const [filters, setFilters] = useState<Filters>(NO_FILTERS);
    const filtering = hasActiveFilters(filters);
    const narrowing = searching || filtering;

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

    // AGF-S2-17: item detail in the owner preview comes from the loaded preview, not the public endpoint
    function findPreviewItem(id: string): MenuItem | undefined {
        for (const menu of (menus ?? []) as unknown as { categories?: { items?: MenuItem[] }[] }[])
            for (const cat of menu.categories ?? [])
                for (const i of cat.items ?? []) if (String(i.id) === id) return i;
        return undefined;
    }

    function addMenuItemToWaiterList(menuItem: any) {
        if (preview) return; // ordering is off in the owner preview
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

    // While searching or filtering: only matching items, and only categories that still have some
    // (AGF-S2-05 search; AGF-S2-14 filters, combined with AND)
    const displayedGroups = useMemo(() => {
        if (!narrowing) return groups;
        return groups
            .map((g) => ({
                ...g,
                items: g.items.filter((i: Searchable & WithDietaryData) => itemMatches(i, searchQuery) && matchesFilters(i, filters)),
            }))
            .filter((g) => g.items.length > 0);
    }, [groups, narrowing, searchQuery, filters]);

    // AGF-S2-14: chips only for data the active menu has
    const chips = useMemo(() => availableChips(groups.flatMap((g) => g.items)), [groups]);
    const matchCount = displayedGroups.reduce((n, g) => n + g.items.length, 0);

    function toggleDiet(diet: DietKey) {
        setFilters((f) => ({ ...f, diets: f.diets.includes(diet) ? f.diets.filter((d) => d !== diet) : [...f.diets, diet] }));
        setActiveCategoryId("ALL");
    }

    function toggleAllergen(allergen: string) {
        setFilters((f) => ({
            ...f,
            excluded: f.excluded.includes(allergen) ? f.excluded.filter((a) => a !== allergen) : [...f.excluded, allergen],
        }));
        setActiveCategoryId("ALL");
    }

    // AGF-S2-15: the active menu's featured items, from the same guest-visible groups (not copied)
    const picks = useMemo(() => featuredItems<FeaturedItem>(groups), [groups]);

    const tabCategories = narrowing ? displayedGroups.map((g) => g.category) : sortedCategories;

    function handleSearchChange(q: string) {
        setSearchQuery(q);
        setActiveCategoryId("ALL");
    }

    function handleSelectMenu(menuId: string) {
        setActiveMenuId(menuId);
        setFilters(NO_FILTERS);
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

    // AGF-S2-33: unknown restaurant → not-found; server or network failure without data → unavailable + Retry
    if (notFound) return <NotFound context="restaurant" />;
    if (error && !business && !preview) {
        return (
            <StatusCard
                title="This menu is temporarily unavailable"
                text="Please try again in a moment."
                actions={<button type="button" onClick={publicMenu.retry} className={statusPrimaryClass}>Retry</button>}
            />
        );
    }

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
                                <Outlet context={{
                                    addToWaiterList: addMenuItemToWaiterList,
                                    preview: preview ? { findItem: findPreviewItem, addDisabledLabel: preview.addDisabledLabel } : undefined,
                                } satisfies GuestMenuOutletContext} />
                            </div>
                         ) : (
                            <>
                                <DietaryFilters
                                    diets={chips.diets}
                                    allergens={chips.allergens}
                                    value={filters}
                                    onToggleDiet={toggleDiet}
                                    onToggleAllergen={toggleAllergen}
                                />
                                <p role="status" aria-live="polite" className="sr-only">
                                    {filtering ? `${matchCount} item${matchCount === 1 ? "" : "s"} match` : ""}
                                </p>
                                {filtering && displayedGroups.length === 0 && (
                                    <div className="py-12 text-center">
                                        <p className="text-base font-semibold text-gray-900">No items match these filters</p>
                                        <p className="mt-1 text-sm text-gray-500">Turn off a filter, or check the other menus.</p>
                                        <button
                                            type="button"
                                            onClick={() => setFilters(NO_FILTERS)}
                                            className="mt-4 inline-flex items-center rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 shadow-sm hover:bg-gray-50"
                                        >
                                            Clear filters
                                        </button>
                                    </div>
                                )}
                                {!filtering && searching && displayedGroups.length === 0 && (
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
                                {/* AGF-S2-15: hidden while searching or filtering (S2-14), so results aren't listed twice */}
                                {!narrowing && (
                                    <FeaturedSection items={picks} currency={activeMenu?.currency} onAddItem={addMenuItemToWaiterList} addDisabledLabel={addDisabledLabel} />
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
                                            addDisabledLabel={addDisabledLabel}
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
