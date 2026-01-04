import React from "react";
import { clsx } from "../../utils/clsx";

type Props = {
    active: boolean;
    label: string;
    onClick: () => void;
    tabId?: string; // <-- added (for auto-scroll into view)
};

export function CategoryTab({ active, label, onClick, tabId }: Props) {
    return (
        <button
            onClick={onClick}
            data-cat-tab={tabId} // <-- added
            className={clsx(
                "shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2",
                active
                    ? "bg-emerald-700 text-white shadow-sm"
                    : "bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50 hover:ring-gray-300"
            )}
        >
            {label}
        </button>
    );
}
