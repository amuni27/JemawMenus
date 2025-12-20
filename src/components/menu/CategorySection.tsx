import React from "react";
import { MenuItemCard } from "./MenuItemCard";

type Props = {
    category: any;
    items: any[];
};

export function CategorySection({ category, items }: Props) {
    return (
        <section className="mb-12">
        <div className="mb-5 flex items-end justify-between">
        <h2 className="text-2xl font-extrabold tracking-tight text-gray-900">
            {category.name}
            </h2>
            </div>

            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item: any) => (
                <MenuItemCard key={item.id} item={item} />
))}

    {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-sm text-gray-500">
            No items available in this category.
    </div>
    ) : null}
    </div>
    </section>
);
}
