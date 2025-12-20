import React from "react";
import { clsx } from "../../utils/clsx";

type Props = {
    active: boolean;
    label: string;
    onClick: () => void;
};

export function CategoryTab({ active, label, onClick }: Props) {
    return (
        <button
            onClick={onClick}
            className={clsx(
                "rounded-full px-4 py-2 text-sm font-semibold transition",
                active
                    ? "bg-emerald-700 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            )}
        >
            {label}
        </button>
    );
}
