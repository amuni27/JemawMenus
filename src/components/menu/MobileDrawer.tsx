import React, { useEffect } from "react";
import { clsx } from "../../utils/clsx";

type Props = {
    open: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
};

export function MobileDrawer({ open, onClose, title = "Menus", children }: Props) {
    // Close drawer on ESC
    useEffect(() => {
        function onKeyDown(e: KeyboardEvent) {
            if (e.key === "Escape") onClose();
        }
        if (open) window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [open, onClose]);

    // If user resizes to desktop, close drawer
    useEffect(() => {
        function onResize() {
            if (window.innerWidth >= 768) onClose();
        }
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, [onClose]);

    return (
        <div
            className={clsx(
                "fixed inset-0 z-50 md:hidden",
                open ? "pointer-events-auto" : "pointer-events-none"
            )}
            aria-hidden={!open}
        >
            {/* overlay */}
            <div
                onClick={onClose}
                className={clsx(
                    "absolute inset-0 bg-black/40 transition-opacity",
                    open ? "opacity-100" : "opacity-0"
                )}
            />

            {/* drawer */}
            <div
                className={clsx(
                    "absolute inset-y-0 left-0 w-[85%] max-w-sm bg-white shadow-xl transition-transform",
                    open ? "translate-x-0" : "-translate-x-full"
                )}
                role="dialog"
                aria-modal="true"
            >
                <div className="flex items-center justify-between border-b px-4 py-4">
                    <div className="text-sm font-bold uppercase tracking-wide text-gray-500">
                        {title}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                        Close
                    </button>
                </div>

                <div className="p-4">{children}</div>
            </div>
        </div>
    );
}
