import apiAuth from "../services/apiAuth.ts";

// AGF-S2-24: daily guest menu openings of the signed-in owner's restaurant (another restaurant is refused by the backend).
export type MenuViewDay = { date: string; views: number };
export type MenuViews = { timeZone: string; today: number; days: MenuViewDay[] };

const menuViewsApi = {
    get(businessId: string, days: number) {
        return apiAuth.get<MenuViews>(`/business/${encodeURIComponent(businessId)}/menu-views`, { params: { days } });
    },
};

export default menuViewsApi;
