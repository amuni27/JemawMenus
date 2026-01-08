import React, { useMemo } from "react";
import {WaiterListMap} from "../../types/menu.ts";
import {BroomIcon, ClearIcon} from "../../assets/svg_icon.tsx";
import {TrashIcon, XIcon} from "lucide-react";



type Props = {
    open: boolean;
    onClose: () => void;
    waiterList: WaiterListMap;

    onIncrement: (itemId: string) => void;
    onDecrement: (itemId: string) => void;
    onRemove: (itemId: string) => void;
    onClear: () => void;
};

export function WaiterListDrawer({
                                     open,
                                     onClose,
                                     waiterList,
                                     onIncrement,
                                     onDecrement,
                                     onRemove,
                                     onClear,
                                 }: Props) {
    const entries = useMemo(() => Object.values(waiterList), [waiterList]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50">
            {/* Backdrop */}
            <button
                type="button"
                className="absolute inset-0 bg-black/30"
                onClick={onClose}
                aria-label="Close waiter list"
            />

            {/* Panel */}
            <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl">
                <div className="flex items-center justify-between border-b px-4 py-3">
                    <div>
                        <div className="text-lg font-bold text-gray-900">Waiter List</div>
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
                                return (
                                    <div key={e.itemId} className="flex gap-3 rounded-2xl border p-3">
                                        <div className="h-14 w-14 overflow-hidden rounded-xl bg-gray-100">
                                            {snap.imageUrl ? (
                                                <img
                                                    src={snap.imageUrl}
                                                    alt={snap.name}
                                                    className="h-full w-full object-cover"
                                                    loading="lazy"
                                                />
                                            ) : null}
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <div className="truncate font-semibold text-gray-900">
                                                {snap.name}
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
                                                    aria-label={`Decrease ${snap.name}`}
                                                >
                                                    –
                                                </button>

                                                <div className="w-10 text-center font-bold">{e.quantity}</div>

                                                <button
                                                    type="button"
                                                    onClick={() => onIncrement(e.itemId)}
                                                    className="h-8 w-8 rounded-full border text-lg font-bold hover:bg-gray-100"
                                                    aria-label={`Increase ${snap.name}`}
                                                >
                                                    +
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => onRemove(e.itemId)}
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
