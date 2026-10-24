import { useId, useState } from "react";
import Button from "../ui/Button";

interface Props {
    label: string;
    values: string[];
    onChange: (values: string[]) => void;
    placeholder?: string;
    /** One-tap additions shown until chosen */
    suggestions?: readonly string[];
}

/** List of short text values entered one at a time; duplicates are ignored regardless of case (AGF-S2-06). */
export default function PillInput({ label, values, onChange, placeholder, suggestions = [] }: Props) {
    const [text, setText] = useState("");
    const labelId = useId();
    const has = (v: string) => values.some((x) => x.toLowerCase() === v.toLowerCase());

    const add = (raw: string) => {
        const v = raw.trim();
        if (v && !has(v)) onChange([...values, v]);
        setText("");
    };

    const open = suggestions.filter((s) => !has(s));

    return (
        <div role="group" aria-labelledby={labelId} className="space-y-2">
            <span id={labelId} className="text-sm font-medium text-gray-700">{label}</span>

            <div className="flex gap-2">
                <input
                    className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-brand focus:border-brand-dark"
                    placeholder={placeholder}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            add(text);
                        }
                    }}
                />
                <Button type="button" onClick={() => add(text)} disabled={!text.trim()}>
                    Add
                </Button>
            </div>

            {open.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {open.map((s) => (
                        <button
                            key={s}
                            type="button"
                            onClick={() => add(s)}
                            aria-label={`Add ${s}`}
                            className="rounded-full border border-dashed border-gray-300 px-2.5 py-0.5 text-xs text-gray-600 hover:bg-gray-50"
                        >
                            + {s}
                        </button>
                    ))}
                </div>
            )}

            {values.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {values.map((v) => (
                        <span key={v} className="flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-sm">
                            {v}
                            <button
                                type="button"
                                onClick={() => onChange(values.filter((x) => x !== v))}
                                className="ml-1 text-gray-500"
                                aria-label={`Remove ${v}`}
                            >
                                ×
                            </button>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}
