// Owner-facing menu state (AGF-S1-15), matching the backend guest-visibility rule (S1-04):
// guests see a menu only when it is published (active) and PUBLIC.
export type MenuStatus = "Live" | "Private" | "Unpublished";

export function menuStatus(menu: { active?: boolean; visibility?: string }): MenuStatus {
    if (!menu.active) return "Unpublished";
    return menu.visibility === "PRIVATE" ? "Private" : "Live";
}

export const MENU_STATUS_CLASSES: Record<MenuStatus, string> = {
    Live: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Private: "bg-indigo-50 text-indigo-700 border-indigo-200",
    Unpublished: "bg-gray-100 text-gray-600 border-gray-200",
};
