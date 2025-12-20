import React from "react";
import { clsx } from "../../utils/clsx";

type Props = {
    menus: any[];
    activeMenuId: string | null;
    onSelectMenu: (menuId: string) => void;
    loading?: boolean;
};

export function MenuSidebar({ menus, activeMenuId, onSelectMenu, loading }: Props) {
    return (
        <div className="h-full">
            <div className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-500">
                Menus
            </div>

            <div className="space-y-2">
                {menus?.map((m: any) => {
                    const active = m.id === activeMenuId;
                    return (
                        <button
                            key={m.id}
                            onClick={() => onSelectMenu(m.id)}
                            className={clsx(
                                "w-full rounded-xl px-3 py-3 text-left transition",
                                active
                                    ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
                                    : "hover:bg-gray-50"
                            )}
                        >
                            <div className="font-semibold">{m.name}</div>
                            {m.description ? (
                                <div className="mt-1 text-xs text-gray-500">{m.description}</div>
                            ) : null}
                        </button>
                    );
                })}

                {!menus?.length && !loading ? (
                    <div className="text-sm text-gray-500">No menus found.</div>
                ) : null}
            </div>
        </div>
    );
}
