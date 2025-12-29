import React from "react";

export function IngredientPill({ text }: { text: string }) {
    return (
        <span className="inline-flex items-center rounded-full border border-emerald-700 px-1 py-0.5 text-xs font-semibold text-emerald-700">
      {text}
    </span>
    );
}
