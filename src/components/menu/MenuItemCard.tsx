import React from "react";
import { IngredientPill } from "./IngredientPill";

type Props = {
    item: any;
};

export function MenuItemCard({ item }: Props) {
    return (
        <article className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
            <div className="relative h-32 overflow-hidden bg-gray-100">
                {item.imageUrl ? (
                    <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="h-full w-full object-cover transition-transform duration-300 ease-out hover:scale-105"
                    />
                ) : (
                    <div className="flex h-full items-center justify-center text-gray-400">
                        No image
                    </div>
                )}
            </div>

            <div className="p-6">
                <h3 className="text-xl font-extrabold tracking-tight text-gray-900">
                    {item.name}
                </h3>

                {item.description ? (
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-gray-600">
                        {item.description}
                    </p>
                ) : null}

                <div className="mt-3 flex items-center justify-between text-sm text-gray-700">
                    <span className="font-semibold">{Number(item.price).toFixed(2)}</span>
                    {typeof item.calories === "number" ? (
                        <span className="text-gray-500">{item.calories} cals</span>
                    ) : null}
                </div>

                {item.ingredients?.length ? (
                    <div className="mt-5">
                        <div className="text-sm font-semibold text-gray-800">Ingredients:</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                            {item.ingredients.slice(0, 5).map((ing: string) => (
                                <IngredientPill key={ing} text={ing} />
                            ))}
                        </div>
                    </div>
                ) : null}
            </div>
        </article>
    );
}
