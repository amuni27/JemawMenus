import React from "react";
import {CategoryTab} from "./CategoryTab";

type Props = {
    businessName?: string;
    activeMenuDescription?: string;
    activeMenuCurrency?: string;
    categories: any[];
    activeCategoryId: string | "ALL";
    onChangeCategory: (id: string | "ALL") => void;
    onOpenDrawer: () => void;
};

export function MenuHeader({
                               businessName,
                               activeMenuDescription,
                               activeMenuCurrency,
                               categories,
                               activeCategoryId,
                               onChangeCategory,
                               onOpenDrawer,
                           }: Props) {
    return (
        <header className="border-b bg-white">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
                <div className="flex items-start gap-3">
                    <button
                        type="button"
                        onClick={onOpenDrawer}
                        className="mt-1 inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-700 shadow-sm hover:bg-gray-50 md:hidden"
                        aria-label="Open menus"
                    >
                        ☰
                    </button>


                    <div className=" mt-1 inline-flex items-center justify-center  bg-white px-2 py-1 text-gray-700 ">
                        <p className="text-2xl font-extrabold text-gray-900">{businessName ?? "Menu"}</p>
                    </div>

                </div>

                {activeMenuCurrency ? (
                    <div className="hidden text-sm font-semibold text-gray-600 sm:block">
                        Currency: <span className="text-gray-900">{activeMenuCurrency}</span>
                    </div>
                ) : null}
            </div>

            <div className="mx-auto max-w-7xl px-6 pb-4">
                <div className="flex flex-wrap items-center gap-2">
                    <CategoryTab
                        active={activeCategoryId === "ALL"}
                        label="All"
                        onClick={() => onChangeCategory("ALL")}
                    />

                    {categories.map((c: any) => (
                        <CategoryTab
                            key={c.id}
                            active={activeCategoryId === c.id}
                            label={c.name}
                            onClick={() => onChangeCategory(c.id)}
                        />
                    ))}
                </div>
            </div>
        </header>
    );
}
