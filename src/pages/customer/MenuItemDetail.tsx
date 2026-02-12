import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import publicMenueApi from "../../api/publicMenueApi.ts";
import { MenuItem } from "../../types/menu.ts";

export default function MenuItemDetail() {
    const navigate = useNavigate();
    const { tenantSlug, itemId } = useParams();

    const [item, setItem] = useState<MenuItem | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!tenantSlug || !itemId) return;

        setLoading(true);
        publicMenueApi
            .findItem(`/venue/items/${itemId}`)
            .then((res) => setItem(res.data))
            .catch(() => setItem(null))
            .finally(() => setLoading(false));
    }, [tenantSlug, itemId]);

    const priceNumber = useMemo(() => {
        const raw = item?.price;
        if (raw === null || raw === undefined) return null;
        const n = Number(raw);
        return Number.isFinite(n) ? n : null;
    }, [item?.price]);

    // jsonb helpers (handles array OR string OR object)
    const toStringArray = (val: any): string[] => {
        if (!val) return [];
        if (Array.isArray(val)) return val.map(String);
        if (typeof val === "object") {
            const maybe = (val.items ?? val.values ?? val.data) as any;
            return Array.isArray(maybe) ? maybe.map(String) : [];
        }
        if (typeof val === "string")
            return val
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
        return [];
    };

    const ingredients = toStringArray(item?.ingredients);
    const allergens = toStringArray(item?.allergens);
    const tags = toStringArray(item?.tags);

    if (loading) {
        return <div className="p-4 text-center text-gray-500">Loading...</div>;
    }

    if (!item) {
        return (
            <div className="p-4 text-center">
                <p className="text-gray-700">Item not found.</p>
                <button
                    className="mt-3 rounded-lg border px-4 py-2 text-sm"
                    onClick={() => navigate(-1)}
                >
                    Go back
                </button>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-5xl p-4">
            {/* Mobile: stacked | Desktop: side-by-side */}
            <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
                {/* LEFT: Image */}
                <div className="lg:sticky lg:top-6">
                    {item.imageUrl ? (
                        <img
                            src={item.imageUrl}
                            alt={item.name ?? "Menu item"}
                            className="h-64 w-full rounded-2xl object-cover shadow-sm lg:h-[420px]"
                        />
                    ) : (
                        <div className="flex h-64 w-full items-center justify-center rounded-2xl bg-gray-100 text-sm text-gray-400 lg:h-[420px]">
                            No image
                        </div>
                    )}
                </div>

                {/* RIGHT: Details */}
                <div className="rounded-2xl lg:bg-white lg:p-4 lg:shadow-sm">
                    {/* Title + Price logic */}
                    <div className="flex flex-col gap-1">
                        <div className="flex items-start justify-between gap-3 lg:justify-start">
                            <h1 className="text-2xl font-bold text-gray-900 lg:text-3xl">
                                {item.name ?? "Untitled item"}
                            </h1>

                            {/* Mobile price beside title */}
                            <div className="text-right lg:hidden">
                                {priceNumber !== null ? (
                                    <div className="text-sm font-semibold text-gray-900">
                                        ETB {priceNumber.toFixed(2)}
                                    </div>
                                ) : (
                                    <div className="text-sm text-gray-400">Price not set</div>
                                )}
                            </div>
                        </div>

                        {/* Desktop price under title (slightly softer color) */}
                        <div className="hidden lg:block">
                            {priceNumber !== null ? (
                                <div className="text-xl font-semibold text-gray-700">
                                    ETB {priceNumber.toFixed(2)}
                                </div>
                            ) : (
                                <div className="text-sm text-gray-400">Price not set</div>
                            )}
                        </div>

                        {/* Small divider (more “senior” polish) */}
                        <hr className="my-3 border-gray-200" />
                    </div>

                    {item.description ? (
                        <p className="mt-2 text-gray-600">{item.description}</p>
                    ) : (
                        <p className="mt-2 text-sm text-gray-400 italic">No description</p>
                    )}

                    <div className="mt-3 flex flex-wrap gap-3 text-sm text-gray-500">
                        {typeof item.calories === "number" && <span>🔥 {item.calories} cal</span>}
                        {typeof item.prepTimeMinutes === "number" && (
                            <span>⏱ {item.prepTimeMinutes} min</span>
                        )}
                        {item.spiceLevel && <span>🌶 {item.spiceLevel}</span>}
                    </div>

                    {ingredients.length > 0 && (
                        <section className="mt-5">
                            <h3 className="font-semibold text-gray-900">Ingredients</h3>
                            <div className="mt-3 flex flex-wrap gap-3">
                                {ingredients.map((x, i) => (
                                    <span
                                        key={i}
                                        className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700"
                                    >
                    {x}
                  </span>
                                ))}
                            </div>
                        </section>
                    )}

                    {allergens.length > 0 && (
                        <section className="mt-5">
                            <h3 className="font-semibold text-red-700">Allergens</h3>
                            <div className="mt-3 flex flex-wrap gap-3">
                                {allergens.map((x, i) => (
                                    <span
                                        key={i}
                                        className="rounded-full bg-red-100 px-3 py-1 text-sm text-red-700"
                                    >
                    {x}
                  </span>
                                ))}
                            </div>
                        </section>
                    )}

                    {tags.length > 0 && (
                        <section className="mt-5">
                            <div className="flex flex-wrap gap-2">
                                {tags.map((t, i) => (
                                    <span
                                        key={i}
                                        className="rounded bg-emerald-100 px-2 py-1 text-xs text-emerald-700"
                                    >
                    #{t}
                  </span>
                                ))}
                            </div>
                        </section>
                    )}

                    <div className="mt-6">
                        <button
                            className="rounded-lg border px-4 py-2 text-sm bg-emerald-600"
                            onClick={() => navigate(-1)}
                        >
                            <span className="text-white">Add to list</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
