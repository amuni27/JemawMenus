import { useId } from "react";
import { MenuItemCard } from "./MenuItemCard";
import type { FeaturedItem } from "./FeaturedSection";

// AGF-S2-25 (checkpoint B, D-S2-25-5): the active menu's dishes on special now, at the top of the guest menu.
// Same layout as Chef's picks: one scrolling row on phones, a grid from 640 px up.

type Props = {
    items: FeaturedItem[];
    currency?: string;
    onAddItem?: (item: FeaturedItem) => void;
    addDisabledLabel?: string;
};

export function SpecialsSection({ items, currency, onAddItem, addDisabledLabel }: Props) {
    const headingId = useId();
    if (items.length === 0) return null;
    return (
        <section aria-labelledby={headingId} className="mb-10 sm:mb-12 rounded-2xl bg-rose-50 p-3 ring-1 ring-rose-100 sm:p-4">
            <div className="mb-3 sm:mb-4">
                <h2 id={headingId} className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">Specials</h2>
                <p className="mt-1 text-sm text-gray-600">{items.length} special{items.length === 1 ? "" : "s"} right now</p>
            </div>
            <ul className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1 sm:mx-0 sm:grid sm:snap-none sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3 xl:grid-cols-4">
                {items.map((item) => (
                    <li key={item.id} className="w-[70%] shrink-0 snap-start sm:w-auto">
                        <MenuItemCard item={item} currency={currency} onAddItem={onAddItem} addDisabledLabel={addDisabledLabel} showSpecialNote />
                    </li>
                ))}
            </ul>
        </section>
    );
}
