import React from "react";
import { MenuItemCard } from "./MenuItemCard";

type Props = {
    category: any;
    items: any[];
    currency?: string;
    onAddItem?: (item: any) => void;
};

export function CategorySection({ category, items, currency, onAddItem  }: Props) {
    const itemCount = items?.length ?? 0;

    return (
        <section className="mb-10 sm:mb-12 p-1">
            <div className="mb-4 flex items-end justify-between gap-3">
                <div>
                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">
                        {category.name}
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                        {itemCount} item{itemCount === 1 ? "" : "s"}
                    </p>
                </div>

                <div className="hidden sm:block h-px flex-1 bg-gray-200" />
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {items.map((item: any) => (
                    <MenuItemCard key={item.id} item={item} currency={currency}  onAddItem={onAddItem}/>
                ))}

                {itemCount === 0 ? (
                    <div className="col-span-full rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
                        <div className="text-sm font-semibold text-gray-900">No items yet</div>
                        <div className="mt-1 text-sm text-gray-500">
                            This category doesn’t have available items right now.
                        </div>
                    </div>
                ) : null}
            </div>
        </section>
    );
}
