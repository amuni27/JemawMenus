// Guest-side item status rules (mirror the backend PublicVisibilityPolicy, AGF-S1-04/S1-13).
// AVAILABLE: shown and orderable. OUT_OF_STOCK: shown as Sold Out, not orderable. Anything else: hidden.

export const SOLD_OUT_STATUS = "OUT_OF_STOCK";

export function isSoldOut(status?: string | null): boolean {
    return status === SOLD_OUT_STATUS;
}

export function isGuestVisible(status?: string | null): boolean {
    return status === "AVAILABLE" || status === SOLD_OUT_STATUS;
}
