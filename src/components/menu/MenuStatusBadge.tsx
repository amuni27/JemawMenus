import {MENU_STATUS_CLASSES, menuStatus} from "../../utils/menuStatus";

// Live / Private / Unpublished badge for a menu (AGF-S1-15)
export default function MenuStatusBadge({menu}: { menu: { active?: boolean; visibility?: string } }) {
    const status = menuStatus(menu);
    return (
        <span
            data-testid="menu-status"
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${MENU_STATUS_CLASSES[status]}`}
        >
            {status}
        </span>
    );
}
