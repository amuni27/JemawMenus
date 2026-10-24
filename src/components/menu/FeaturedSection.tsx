import { useEffect, useId, useRef, useState } from "react";
import { MenuItemCard } from "./MenuItemCard";

export type FeaturedItem = { id: string | number } & Record<string, unknown>;

type Props = {
    items: FeaturedItem[];
    currency?: string;
    onAddItem?: (item: FeaturedItem) => void;
};

/**
 * AGF-S2-15: "Chef's picks" at the top of the guest menu. One horizontally scrolling row on phones,
 * the category grid from 640 px up. Not a category: it has no tab and isn't part of the scroll sync.
 */
export function FeaturedSection({ items, currency, onAddItem }: Props) {
    const headingId = useId();
    const listRef = useRef<HTMLUListElement | null>(null);
    // Only a row that actually scrolls sideways needs to be focusable (keyboard scrolling)
    const [scrollable, setScrollable] = useState(false);

    useEffect(() => {
        const update = () => {
            const el = listRef.current;
            setScrollable(!!el && el.scrollWidth > el.clientWidth);
        };
        update();
        window.addEventListener("resize", update);
        return () => window.removeEventListener("resize", update);
    }, [items.length]);

    if (items.length === 0) return null;

    return (
        <section
            aria-labelledby={headingId}
            className="mb-10 sm:mb-12 rounded-2xl bg-amber-50 p-3 ring-1 ring-amber-100 sm:p-4"
        >
            <div className="mb-3 sm:mb-4">
                <h2 id={headingId} className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">
                    Chef's picks
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                    {items.length} pick{items.length === 1 ? "" : "s"}
                </p>
            </div>

            <ul
                ref={listRef}
                tabIndex={scrollable ? 0 : undefined}
                aria-label={scrollable ? "Chef's picks, scroll for more" : undefined}
                className="
                    -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500
                    sm:mx-0 sm:grid sm:snap-none sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0
                    lg:grid-cols-3 xl:grid-cols-4
                "
            >
                {items.map((item) => (
                    <li key={item.id} className="w-[70%] shrink-0 snap-start sm:w-auto">
                        <MenuItemCard item={item} currency={currency} onAddItem={onAddItem} />
                    </li>
                ))}
            </ul>
        </section>
    );
}
