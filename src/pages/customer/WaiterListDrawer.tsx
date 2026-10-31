import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { useLocalized } from "../../utils/guestLanguage";
import {WaiterListMap} from "../../types/menu.ts";
import {BroomIcon, ClearIcon} from "../../assets/svg_icon.tsx";
import {TrashIcon, XIcon} from "lucide-react";



type Props = {
    open: boolean;
    onClose: () => void;
    waiterList: WaiterListMap;
    soldOutItemIds?: Set<string>; // entries for these items are marked Sold out and cannot be increased

    onIncrement: (itemId: string) => void;
    onDecrement: (itemId: string) => void;
    onRemove: (itemId: string) => void;
    onClear: () => void;
};

export function WaiterListDrawer({
                                     open,
                                     onClose,
                                     waiterList,
                                     soldOutItemIds,
                                     onIncrement,
                                     onDecrement,
                                     onRemove,
                                     onClear,
                                 }: Props) {
    const t = useLocalized(); // AGF-S2-23: names in the selected language
    const entries = useMemo(() => Object.values(waiterList), [waiterList]);

    // AGF-S2-27: a modal dialog. Focus moves into it, stays inside, Escape closes it, and focus returns to the
    // control that opened it (WCAG 2.1.2, 2.4.3, 4.1.2).
    const titleId = useId();
    const panelRef = useRef<HTMLDivElement>(null);
    const closeRef = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        if (!open) return;
        const opener = document.activeElement as HTMLElement | null;
        closeRef.current?.focus();
        return () => opener?.focus();
    }, [open]);

    const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === "Escape") {
            e.stopPropagation();
            onClose();
            return;
        }
        if (e.key !== "Tab" || !panelRef.current) return;
        const focusables = Array.from(panelRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'));
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50">
            {/* Backdrop: closes on click; not a tab stop (the Close button is the keyboard way out) */}
            <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden="true" />

            {/* Panel */}
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                onKeyDown={onKeyDown}
                className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl"
            >
                <div className="flex items-center justify-between border-b px-4 py-3">
                    <div>
                        <h2 id={titleId} className="text-lg font-bold text-gray-900">Waiter List</h2>
                        <div className="text-xs text-gray-500">Temporary list (session only)</div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClear}
                            className="inline-flex h-9 p-2 items-center justify-center rounded-lg border text-gray-700 hover:bg-gray-100"
                            aria-label="Clear waiter list"
                            title="Clear"
                        >
                            Clear
                        </button>
                        <button
                            ref={closeRef}
                            type="button"
                            onClick={onClose}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border text-gray-700 hover:bg-gray-100"
                            aria-label="Close waiter list"
                            title="Close"
                        >
                            <XIcon className="h-5 w-5"/>
                        </button>
                    </div>
                </div>

                <div className="h-[calc(100%-56px)] overflow-y-auto p-4">
                    {entries.length === 0 ? (
                        <div className="rounded-xl border border-dashed p-6 text-center">
                            <div className="font-semibold text-gray-900">No items yet</div>
                            <div className="mt-1 text-sm text-gray-500">
                                Tap the <b>+</b> button to add items.
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {entries.map((e) => {
                                const snap = e.snapshot;
                                const name = t(snap.name, snap.nameAm); // AGF-S2-23
                                const soldOut = soldOutItemIds?.has(e.itemId) ?? false;
                                return (
                                    <div key={e.itemId} className="flex gap-3 rounded-2xl border p-3">
                                        <div className="h-14 w-14 overflow-hidden rounded-xl bg-gray-100">
                                            <EntryPhoto url={snap.imageUrl} name={name.text} />
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <div lang={name.lang} className="truncate font-semibold text-gray-900">
                                                    {name.text}
                                                </div>
                                                {soldOut ? (
                                                    <span className="shrink-0 rounded-full bg-gray-900 px-2 py-0.5 text-xs font-semibold text-white">
                                                        Sold out
                                                    </span>
                                                ) : null}
                                            </div>

                                            <div className="mt-1 text-sm text-gray-500">
                                                {typeof snap.price === "number" && Number.isFinite(snap.price) ? (
                                                    <>
                                                        {snap.currency ? (
                                                            <span className="font-semibold text-gray-600">
                                {snap.currency}
                              </span>
                                                        ) : null}{" "}
                                                        {snap.price.toFixed(2)}
                                                    </>
                                                ) : (
                                                    "—"
                                                )}
                                            </div>

                                            <div className="mt-2 flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => onDecrement(e.itemId)}
                                                    className="h-8 w-8 rounded-full border text-lg font-bold hover:bg-gray-100"
                                                    aria-label={`Decrease ${name.text}`}
                                                >
                                                    –
                                                </button>

                                                <div className="w-10 text-center font-bold">{e.quantity}</div>

                                                <button
                                                    type="button"
                                                    onClick={() => onIncrement(e.itemId)}
                                                    disabled={soldOut}
                                                    className="h-8 w-8 rounded-full border text-lg font-bold hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                                                    aria-label={`Increase ${name.text}`}
                                                >
                                                    +
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => onRemove(e.itemId)}
                                                    aria-label={`Remove ${name.text}`}
                                                    className="ml-auto rounded-lg border px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                                                >
                                                    <TrashIcon className="h-5 w-5" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

/** AGF-S2-16: the saved photo, or "No image" when there is none or it no longer loads (e.g. the owner removed it) */
function EntryPhoto({ url, name }: { url?: string; name: string }) {
    const [failed, setFailed] = useState(false);
    if (!url || failed) {
        return (
            <div className="flex h-full w-full items-center justify-center text-center text-[10px] leading-tight text-gray-600">
                No image
            </div>
        );
    }
    return <img src={url} alt={name} className="h-full w-full object-cover" loading="lazy" onError={() => setFailed(true)} />;
}
