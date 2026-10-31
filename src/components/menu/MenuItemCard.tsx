import {Link, useNavigate} from "react-router-dom";
import { useLocalized } from "../../utils/guestLanguage";
import { displayCurrency } from "../../utils/currency";
import {isSoldOut} from "../../utils/itemAvailability.ts";
import { declaredDiets, dietLabel } from "../../utils/dietary.ts";

type Props = {
    item: any;
    currency?: string; // pass from parent
    onAddItem?: (item: any) => void;
    /** AGF-S2-17: when set (owner preview), the add button is disabled and announced with this label */
    addDisabledLabel?: string;
};

export function MenuItemCard({ item, currency, onAddItem, addDisabledLabel }: Props) {
    const navigate = useNavigate();

    const openDetail = () => {
        navigate(`item/${item.id}`);
    };
    const price =
        typeof item.price === "number" || typeof item.price === "string"
            ? Number(item.price)
            : null;
    const soldOut = isSoldOut(item.status);
    // AGF-S2-23: the selected language, field by field
    const t = useLocalized();
    const name = t(item.name, item.nameAm);
    const description = t(item.description, item.descriptionAm);
    const addOff = soldOut || Boolean(addDisabledLabel);
    const diets = declaredDiets(item); // AGF-S2-14: badges for the dietary vocabulary only

    return (
        <article
            className="
                group h-full overflow-hidden rounded-2xl bg-white
                ring-1 ring-gray-200 shadow-sm
                transition hover:-translate-y-0.5 hover:shadow-md hover:ring-gray-300
            "
        >
            {/* Image */}
            <div className="relative rounded-2xl border bg-white">
                {/* AGF-S2-27: sold out dims the photo only; text keeps full contrast (WCAG 1.4.3) */}
                <div
                    onClick={openDetail}
                    className="relative h-32 sm:h-36 overflow-hidden bg-gray-100">
                {item.imageUrl ? (
                    <img
                        src={item.imageUrl}
                        alt={name.text}
                        className={`h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-105 ${soldOut ? "opacity-60 grayscale" : ""}`}
                        loading="lazy"
                    />
                ) : (
                    <div className="flex h-full items-center justify-center text-sm text-gray-600">
                        No image
                    </div>
                )}
                </div>

                {/* SOLD OUT badge (text, not colour only) */}
                {soldOut ? (
                    <span className="absolute left-2 top-2 rounded-full bg-gray-900/85 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                        Sold Out
                    </span>
                ) : null}

                {/* ADD BUTTON (Airbnb / DoorDash style) */}
                <div className="absolute inset-y-0 right-3 flex items-center">
                    {/* ADD BUTTON (top-right like DoorDash/Airbnb) */}
                    <button
                        type="button"
                        onClick={() => { if (!addOff) onAddItem?.(item); }}
                        disabled={addOff}
                        aria-label={addDisabledLabel ?? (soldOut ? `${name.text} is sold out` : `Add ${name.text}`)}
                        className={`
    absolute right-1 top-28 lg:top-32 lg:right-3
    inline-flex h-9 w-9 items-center justify-center
    rounded-full text-white
    shadow-lg ring-[3px] ring-white
    transition
    focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500
    ${addOff ? "cursor-not-allowed bg-gray-400" : "bg-emerald-600 hover:bg-emerald-700 active:scale-95"}
  `}
                    >
                        <PlusIcon className="h-6 w-6" />
                    </button>

                </div>
            </div>

            {/* Content */}
            <div
                onClick={openDetail}
                className="flex flex-1 flex-col p-3 sm:p-4">
                <h3 className="text-sm sm:text-base font-semibold text-gray-900 line-clamp-1">
                    {/* AGF-S2-27: the name is the keyboard and screen-reader way to the dish's details (WCAG 2.1.1) */}
                    <Link
                        to={`item/${item.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2"
                    >
                        <span lang={name.lang}>{name.text}</span>
                    </Link>
                </h3>

                {diets.length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                        {diets.map((d) => (
                            <span key={d} className="rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-800">
                                {dietLabel(d)}
                            </span>
                        ))}
                    </div>
                ) : null}

                {description.text ? (
                    <p lang={description.lang} className="mt-1 text-sm text-gray-500 line-clamp-2">
                        {description.text}
                    </p>
                ) : (
                    <p className="mt-1 text-sm text-gray-500 italic">No description</p>
                )}

                <div className="mt-3 flex items-end justify-between">
                    <div className="text-base font-bold text-gray-900">
                        {price !== null && Number.isFinite(price) ? (
                            <>
                                <span className="text-sm font-semibold text-gray-500">{displayCurrency(currency)}</span>{" "}
                                {price.toFixed(2)}
                            </>
                        ) : (
                            <span className="text-sm text-gray-500">Price not set</span>
                        )}
                    </div>

                    {typeof item.calories === "number" ? (
                        <span className="text-xs text-gray-500">{item.calories} cal</span>
                    ) : null}
                </div>
            </div>
        </article>
    );
}

/* ---------- Plus icon ---------- */
function PlusIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 20 20" fill="currentColor" {...props}>
            <path
                fillRule="evenodd"
                d="M10 4.75a.75.75 0 0 1 .75.75v3.75h3.75a.75.75 0 0 1 0 1.5h-3.75v3.75a.75.75 0 0 1-1.5 0v-3.75H5.5a.75.75 0 0 1 0-1.5h3.75V5.5a.75.75 0 0 1 .75-.75Z"
                clipRule="evenodd"
            />
        </svg>
    );
}
