import { useCallback, useState } from "react";
import { errorMessage } from "./errorMessage";

// Backend validation errors (S1-10: `fieldErrors: [{field, message}]`) shown under the matching form fields (AGF-S2-11).

type ApiFieldError = { field?: unknown; message?: unknown };
type Shown = { message: string; submitted: string };

/** "ingredients[0]" → "ingredients", "businessHours[2].startTime" → "businessHours" */
function baseField(field: string): string {
    return field.split(/[.[]/)[0];
}

function asText(value: unknown): string {
    if (value === null || value === undefined) return "";
    return Array.isArray(value) ? value.join("\u0000") : String(value);
}

/** Base field names in an API validation error (e.g. to open the wizard step that holds them). */
export function apiFieldNames(err: unknown): string[] {
    const list = (err as { response?: { data?: { fieldErrors?: unknown } } })?.response?.data?.fieldErrors;
    if (!Array.isArray(list)) return [];
    return (list as ApiFieldError[])
        .map((e) => (typeof e?.field === "string" ? baseField(e.field) : ""))
        .filter(Boolean);
}

export function useFieldErrors() {
    const [errors, setErrors] = useState<Record<string, Shown>>({});

    /**
     * Maps an API error onto the form's fields. `submitted` holds the values that were sent, keyed by the
     * backend field name; only those fields are shown inline. Returns the message for a banner/toast:
     * unknown-field messages, or the server message when there are no field errors, or null.
     */
    const apply = useCallback((err: unknown, submitted: Record<string, unknown>, fallback: string): string | null => {
        const list = (err as { response?: { data?: { fieldErrors?: unknown } } })?.response?.data?.fieldErrors;
        if (!Array.isArray(list) || list.length === 0) {
            setErrors({});
            return errorMessage(err, fallback);
        }

        const next: Record<string, Shown> = {};
        const unknown: string[] = [];
        for (const entry of list as ApiFieldError[]) {
            const field = typeof entry?.field === "string" ? baseField(entry.field) : "";
            const message = typeof entry?.message === "string" && entry.message.trim() ? entry.message : "Invalid value";
            if (field && Object.prototype.hasOwnProperty.call(submitted, field)) {
                if (!next[field]) next[field] = { message, submitted: asText(submitted[field]) };
            } else if (!unknown.includes(message)) {
                unknown.push(message);
            }
        }
        setErrors(next);
        return unknown.length > 0 ? unknown.join(" ") : null;
    }, []);

    /** The field's message while its value is still the one that was rejected; hidden once the user changes it. */
    const errorFor = useCallback((field: string, currentValue: unknown): string | undefined => {
        const shown = errors[field];
        return shown && shown.submitted === asText(currentValue) ? shown.message : undefined;
    }, [errors]);

    /** Fields that currently have a backend error (e.g. to open the right wizard step). */
    const fields = Object.keys(errors);

    const clear = useCallback(() => setErrors({}), []);

    return { apply, errorFor, fields, clear };
}
