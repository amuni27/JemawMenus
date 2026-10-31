import { useId } from "react";
import { MenuItemCard } from "./MenuItemCard";
import type { FeaturedItem } from "./FeaturedSection";
import { Localized } from "./Localized";
import { categoryBadgeText, type CategorySpecialInfo } from "../../utils/specials";

// AGF-S2-25 (checkpoint B, D-S2-25-5): the active menu's dishes on special now, at the top of the guest menu.
// Same layout as Chef's picks: one scrolling row on phones, a grid from 640 px up.
// AGF-S2-36 (D-CS-7): each active category special is one line that jumps to its category, so a large category
// doesn't flood the section.

export type CategorySpecialLine = { id: string; name: string; nameAm?: string | null; special: CategorySpecialInfo };

type Props = {
    items: FeaturedItem[];
    currency?: string;
    onAddItem?: (item: FeaturedItem) => void;
    addDisabledLabel?: string;
    categories?: CategorySpecialLine[];
    onSelectCategory?: (categoryId: string) => void;
};

export function SpecialsSection({ items, currency, onAddItem, addDisabledLabel, categories = [], onSelectCategory }: Props) {
    const headingId = useId();
    const count = items.length + categories.length;
    if (count === 0) return null;
    return (
        <section aria-labelledby={headingId} className="mb-10 sm:mb-12 rounded-2xl bg-rose-50 p-3 ring-1 ring-rose-100 sm:p-4">
            <div className="mb-3 sm:mb-4">
                <h2 id={headingId} className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">Specials</h2>
                <p className="mt-1 text-sm text-gray-600">{count} special{count === 1 ? "" : "s"} right now</p>
            </div>
            {categories.length > 0 && (
                <ul className="mb-3 space-y-2">
                    {categories.map((c) => (
                        <li key={c.id}>
                            <button
                                type="button"
                                onClick={() => onSelectCategory?.(c.id)}
                                className="flex w-full items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 text-left text-sm shadow-sm ring-1 ring-rose-100 hover:bg-rose-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-700"
                            >
                                <span>
                                    <span className="font-semibold text-gray-900"><Localized main={c.name} am={c.nameAm} /></span>
                                    <span className="text-gray-500"> · </span>
                                    <span className="font-semibold text-rose-800">{categoryBadgeText(c.special)}</span>
                                </span>
                                <span aria-hidden="true" className="text-rose-800">→</span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            {items.length > 0 && (
            <ul className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1 sm:mx-0 sm:grid sm:snap-none sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3 xl:grid-cols-4">
                {items.map((item) => (
                    <li key={item.id} className="w-[70%] shrink-0 snap-start sm:w-auto">
                        <MenuItemCard item={item} currency={currency} onAddItem={onAddItem} addDisabledLabel={addDisabledLabel} showSpecialNote />
                    </li>
                ))}
            </ul>
            )}
        </section>
    );
}
