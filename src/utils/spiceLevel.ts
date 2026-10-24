// Spice levels the backend accepts (SpiceLevel enum) and their labels (AGF-S2-06).
export const SPICE_LEVELS = [
    { value: "NONE", label: "None" },
    { value: "MILD", label: "Mild" },
    { value: "MEDIUM", label: "Medium" },
    { value: "HOT", label: "Hot" },
    { value: "EXTRA_HOT", label: "Extra hot" },
] as const;

/** Guest label for a stored level; null for "NONE" or no level. An unknown stored value is shown as-is. */
export function spiceLabel(level?: string | null): string | null {
    if (!level || level === "NONE") return null;
    return SPICE_LEVELS.find((s) => s.value === level)?.label ?? level;
}
