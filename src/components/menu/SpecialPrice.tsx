import { displayCurrency, formatPrice } from "../../utils/currency";
import { Localized } from "./Localized";
import type { SpecialFields } from "../../utils/specials";

// AGF-S2-25 (checkpoint B): a special price with the regular price struck through, a "Special" badge and the end
// time. Screen readers hear "Special price … Regular price …".

export function SpecialBadge({ until }: { until?: string | null }) {
    return (
        <span className="inline-flex items-center gap-1.5 text-xs">
            <span className="rounded-full bg-rose-700 px-2 py-0.5 font-semibold uppercase tracking-wide text-white">Special</span>
            {until ? <span className="font-medium text-rose-800">until {until}</span> : null}
        </span>
    );
}

/** Card style: "ETB 350.00 ~~420.00~~" */
export function CardSpecialPrice({ item, currency }: { item: SpecialFields; currency?: string }) {
    return (
        <>
            <span className="sr-only">Special price </span>
            <span className="text-sm font-semibold text-gray-500">{displayCurrency(currency)}</span>{" "}
            <span className="text-rose-800">{Number(item.specialPrice).toFixed(2)}</span>{" "}
            <s className="text-sm font-medium text-gray-500"><span className="sr-only">Regular price </span><span>{Number(item.price).toFixed(2)}</span></s>
        </>
    );
}

/** Detail style: "ETB 350.00 ~~ETB 420.00~~" */
export function DetailSpecialPrice({ item, currency }: { item: SpecialFields; currency?: string }) {
    return (
        <>
            <span className="sr-only">Special price </span>
            <span className="text-rose-800">{formatPrice(Number(item.specialPrice), currency)}</span>{" "}
            <s className="text-sm font-medium text-gray-500"><span className="sr-only">Regular price </span><span>{formatPrice(Number(item.price), currency)}</span></s>
        </>
    );
}

export function SpecialNote({ item }: { item: SpecialFields }) {
    if (!item.specialNote && !item.specialNoteAm) return null;
    return (
        <p className="text-sm font-medium text-rose-800">
            <Localized main={item.specialNote} am={item.specialNoteAm} />
        </p>
    );
}
