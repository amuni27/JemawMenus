import { ALLERGEN_NOTE, dietLabel, type DietaryFilters as Filters, type DietKey } from "../../utils/dietary";
import { clsx } from "../../utils/clsx";

type Props = {
    diets: readonly DietKey[];
    allergens: readonly string[];
    value: Filters;
    onToggleDiet: (diet: DietKey) => void;
    onToggleAllergen: (allergen: string) => void;
};

const chipClass = (on: boolean) =>
    clsx(
        "inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-semibold transition",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2",
        on ? "bg-emerald-700 text-white shadow-sm" : "bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50"
    );

/**
 * AGF-S2-14: dietary chips and "Exclude declared" allergen chips for the guest menu. Toggle buttons; one
 * horizontally scrolling row on phones. Renders nothing when the menu has no dietary data.
 */
export function DietaryFilters({ diets, allergens, value, onToggleDiet, onToggleAllergen }: Props) {
    if (diets.length === 0 && allergens.length === 0) return null;

    return (
        <div className="mb-6">
            <div role="group" aria-label="Dietary filters" className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 py-1">
                {diets.map((d) => {
                    const on = value.diets.includes(d);
                    return (
                        <button key={d} type="button" aria-pressed={on} onClick={() => onToggleDiet(d)} className={chipClass(on)}>
                            {dietLabel(d)}
                        </button>
                    );
                })}

                {allergens.length > 0 && (
                    <>
                        {diets.length > 0 && <span aria-hidden="true" className="mx-1 h-6 w-px shrink-0 bg-gray-200" />}
                        <span className="shrink-0 text-sm font-medium text-gray-600">Exclude declared:</span>
                        {allergens.map((a) => {
                            const on = value.excluded.includes(a);
                            return (
                                <button
                                    key={a}
                                    type="button"
                                    aria-pressed={on}
                                    aria-label={`Exclude declared: ${a}`}
                                    onClick={() => onToggleAllergen(a)}
                                    className={chipClass(on)}
                                >
                                    {a}
                                </button>
                            );
                        })}
                    </>
                )}
            </div>

            {allergens.length > 0 && <p className="mt-2 text-xs text-gray-500">{ALLERGEN_NOTE}</p>}
        </div>
    );
}
