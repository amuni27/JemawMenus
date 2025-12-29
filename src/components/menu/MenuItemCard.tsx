import {IngredientPill} from "./IngredientPill.tsx";

type Props = {
    item: any; // we’ll tighten this later if you want
};

export function MenuItemCard({ item }: Props) {
    return (
        <article className="h-full overflow-hidden rounded-2xl border bg-white shadow-sm">
            <div className="relative h-32 sm:h-52 overflow-hidden bg-gray-100">
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

            <div className="flex flex-1 flex-col p-3 sm:p-4">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                    {item.name}
                </h3>

                {item.description ? (
                    <p className="text-xs text-gray-500">
                        {item.description}
                    </p>
                ) : null}

                <div className="mt-2 flex items-center justify-between text-xs sm:text-sm text-gray-700">
                    <span className="font-semibold">{Number(item.price).toFixed(2)}</span>
                    {typeof item.calories === "number" ? (
                        <span className="text-gray-500">{item.calories} cals</span>
                    ) : null}
                </div>

                {item.ingredients?.length ? (
                    <div className="mt-3">
                        {/* show fewer pills on mobile */}
                        <div className="mt-2 flex flex-wrap gap-0.5">
                            {item.ingredients
                                .slice(0, 3) // mobile limit
                                .map((ing: string) => (
                                    <IngredientPill key={ing} text={ing} />
                                ))}
                        </div>
                    </div>
                ) : null}
            </div>
        </article>
    );
}
