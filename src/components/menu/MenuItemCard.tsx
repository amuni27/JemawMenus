type Props = {
    item: any;
    currency?: string; // pass from parent
};

export function MenuItemCard({ item, currency = "ETB" }: Props) {
    const price =
        typeof item.price === "number" || typeof item.price === "string"
            ? Number(item.price)
            : null;

    return (
        <article
            className="
        group h-full overflow-hidden rounded-2xl bg-white
        ring-1 ring-gray-200 shadow-sm
        transition hover:-translate-y-0.5 hover:shadow-md hover:ring-gray-300
      "
        >
            <div className="relative h-32 sm:h-36 overflow-hidden bg-gray-100">
                {item.imageUrl ? (
                    <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-105"
                        loading="lazy"
                    />
                ) : (
                    <div className="flex h-full items-center justify-center text-sm text-gray-400">
                        No image
                    </div>
                )}
            </div>

            <div className="flex flex-1 flex-col p-3 sm:p-4">
                <h3 className="text-sm sm:text-base font-semibold text-gray-900 line-clamp-1">
                    {item.name}
                </h3>

                {item.description ? (
                    <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                        {item.description}
                    </p>
                ) : (
                    <p className="mt-1 text-sm text-gray-400 italic">No description</p>
                )}

                <div className="mt-3 flex items-end justify-between">
                    <div className="text-base font-bold text-gray-900">
                        {price !== null && Number.isFinite(price) ? (
                            <>
                                <span className="text-sm font-semibold text-gray-500">{currency}</span>{" "}
                                {price.toFixed(2)}
                            </>
                        ) : (
                            <span className="text-sm text-gray-400">Price not set</span>
                        )}
                    </div>

                    {typeof item.calories === "number" ? (
                        <span className="text-xs text-gray-400">{item.calories} cal</span>
                    ) : null}
                </div>
            </div>
        </article>
    );
}
