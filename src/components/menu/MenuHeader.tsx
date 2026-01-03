import React from "react";
import {MenuSidebar} from "./MenuSidebar.tsx";

type Props = {
    businessName?: string;
    logoUrl?: string;
    activeMenuCurrency?: string;
    menus: any[];
    activeMenuId: string | null;
    handleSelectMenu: (menuId: string) => void;
    loading: boolean
};

export function MenuHeader({
                               businessName,
                               logoUrl,
                               activeMenuCurrency,
                               menus,
                               activeMenuId,
                               handleSelectMenu,
                               loading
                           }: Props) {
    return (
        <header className="border-b bg-white">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
                <div className=" mt-1 inline-flex items-center justify-center  bg-white px-2 py-1 text-gray-700 ">
                    {logoUrl && (
                        <img
                            src={logoUrl}
                            alt={`${businessName ?? "Menu"} logo`}
                            className="h-10 w-10 rounded-lg object-contain"
                        />
                    )}
                    <p className="text-2xl font-extrabold text-gray-900 pl-2">{businessName ?? "Menu"}</p>
                </div>

                {activeMenuCurrency ? (
                    <div className="hidden text-sm font-semibold text-gray-600 sm:block">
                        Currency: <span className="text-gray-900">{activeMenuCurrency}</span>
                    </div>
                ) : null}
            </div>

            <div className="mx-auto max-w-7xl px-6 pb-2">
                <MenuSidebar
                    menus={menus ?? []}
                    activeMenuId={activeMenuId}
                    onSelectMenu={handleSelectMenu}
                    loading={loading}
                />

            </div>
        </header>
    );
}
