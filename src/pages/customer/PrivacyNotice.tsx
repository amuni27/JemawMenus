import React, { useEffect, useId, useRef, useState } from "react";
import { XIcon } from "lucide-react";

// AGF-S2-24 (D-S2-24-2, -3): the guest menu footer's privacy link and the approved menu-views notice. A modal dialog
// as in S2-27: focus moves to Close, stays inside, Escape closes, focus returns to the link.

export const MENU_VIEWS_NOTICE =
    "To show restaurants how often their menu is opened, Agafari counts menu openings per restaurant and per day. "
    + "We don't use cookies for this and don't store your IP address, device or any other information that identifies you. "
    + "Restaurants see only the daily totals.";

export default function PrivacyNotice() {
    const [open, setOpen] = useState(false);
    const titleId = useId();
    const linkRef = useRef<HTMLButtonElement>(null);
    const closeRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!open) return;
        closeRef.current?.focus();
        const link = linkRef.current;
        return () => link?.focus();
    }, [open]);

    const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === "Escape") {
            e.stopPropagation();
            setOpen(false);
        } else if (e.key === "Tab") {
            e.preventDefault(); // Close is the only control inside
            closeRef.current?.focus();
        }
    };

    return (
        <>
            <button
                ref={linkRef}
                type="button"
                onClick={() => setOpen(true)}
                className="text-xs text-gray-600 underline hover:no-underline"
            >
                Privacy
            </button>
            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} aria-hidden="true" />
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={titleId}
                        onKeyDown={onKeyDown}
                        className="relative w-full max-w-sm rounded-2xl bg-white p-5 text-left shadow-xl"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <h2 id={titleId} className="text-base font-bold text-gray-900">Menu views</h2>
                            <button
                                ref={closeRef}
                                type="button"
                                onClick={() => setOpen(false)}
                                aria-label="Close privacy notice"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border text-gray-700 hover:bg-gray-100"
                            >
                                <XIcon aria-hidden="true" className="h-4 w-4" />
                            </button>
                        </div>
                        <p className="mt-3 text-sm text-gray-700">{MENU_VIEWS_NOTICE}</p>
                    </div>
                </div>
            )}
        </>
    );
}
