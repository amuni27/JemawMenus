// AGF-S2-25: owner specials (checkpoint A). Status is computed by the backend in the restaurant's time zone.
/** NOT_A_DISCOUNT: the dish now costs the same or less than the special (read-time guard, checkpoint B) */
export type SpecialStatus = "ACTIVE" | "SCHEDULED" | "ENDED" | "PAUSED" | "NOT_A_DISCOUNT";

export const WEEK_DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"] as const;
export type WeekDay = (typeof WEEK_DAYS)[number];

export interface Special {
    id: string;
    menuItemId: string;
    itemName: string;
    menuId: string;
    menuName: string;
    categoryName?: string | null;
    regularPrice: number;
    specialPrice: number;
    currency?: string;
    note?: string | null;
    noteAm?: string | null;
    startsOn?: string | null;
    endsOn?: string | null;
    daysOfWeek: string[];
    startTime?: string | null;
    endTime?: string | null;
    paused: boolean;
    status: SpecialStatus;
}

/** POST sends filled fields; PATCH sends changed fields ("" clears a note; clear* flags remove dates or the window). */
export type SpecialPayload = Partial<{
    menuItemId: string;
    specialPrice: number;
    note: string;
    noteAm: string;
    startsOn: string;
    endsOn: string;
    daysOfWeek: string[];
    startTime: string;
    endTime: string;
    paused: boolean;
    clearStartsOn: boolean;
    clearEndsOn: boolean;
    clearTimeWindow: boolean;
}>;

/** A dish the owner can put on special. */
export interface DishOption {
    id: string;
    name: string;
    price: number;
    menuId: string;
    menuName: string;
}

// ---- AGF-S2-36: category specials (a percentage off every eligible dish in one category) ----------------------

export interface CategorySpecial {
    id: string;
    categoryId: string;
    categoryName: string;
    menuId: string;
    menuName: string;
    discountPercent: number;
    note?: string | null;
    noteAm?: string | null;
    startsOn?: string | null;
    endsOn?: string | null;
    daysOfWeek: string[];
    startTime?: string | null;
    endTime?: string | null;
    paused: boolean;
    status: SpecialStatus;
    /** Dishes guests can see in the category with a price above 0 */
    eligibleDishes: number;
}

export type CategorySpecialPayload = Omit<SpecialPayload, "menuItemId" | "specialPrice"> & Partial<{
    categoryId: string;
    discountPercent: number;
}>;

/** A category the owner can put on special. */
export interface CategoryOption {
    id: string;
    name: string;
    menuId: string;
    menuName: string;
}
