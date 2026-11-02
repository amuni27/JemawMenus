import apiAuth from "../services/apiAuth.ts";

// AGF E4-M8: the owner's own restaurant ads (Model 3; the restaurant comes from the token). Schedules are local date and time
// in the restaurant's own time zone; no delete (archive).
export type RestaurantAd = {
    id: string; businessId: string; businessName?: string; title: string; body: string; titleAm?: string; bodyAm?: string; linkUrl: string;
    imageUrl?: string; imageAlt?: string; startsAt: string; endsAt?: string; scheduleTimeZone: string; startLocal: string; startOffset: string;
    endLocal?: string; endOffset?: string; status: "ACTIVE" | "PAUSED" | "SUSPENDED" | "ARCHIVED"; suspensionReason?: string; suspendedAt?: string;
    createdAt: string; updatedAt: string; rowVersion: number;
};
export type RestaurantAdInput = {
    title: string; body: string; titleAm?: string; bodyAm?: string; linkUrl: string; startLocal: string; endLocal?: string;
    startOffset?: string; endOffset?: string; rowVersion?: number;
};
// canManage: restaurant ads are on and the restaurant is on a current Model 3 plan; otherwise read and archive only
export type RestaurantAdsView = { canManage: boolean; cap: number; nonArchivedCount: number; timeZone: string; ads: RestaurantAd[] };

const restaurantAdsApi = {
    list: () => apiAuth.get<RestaurantAdsView>("/restaurant-ads"),
    create: (input: RestaurantAdInput) => apiAuth.post<RestaurantAd>("/restaurant-ads", input),
    update: (id: string, input: RestaurantAdInput) => apiAuth.put<RestaurantAd>(`/restaurant-ads/${id}`, input),
    pause: (id: string, rowVersion: number) => apiAuth.post<RestaurantAd>(`/restaurant-ads/${id}/pause`, { rowVersion }),
    resume: (id: string, rowVersion: number) => apiAuth.post<RestaurantAd>(`/restaurant-ads/${id}/resume`, { rowVersion }),
    archive: (id: string, rowVersion: number) => apiAuth.post<RestaurantAd>(`/restaurant-ads/${id}/archive`, { rowVersion }),
    presignImage: (id: string, contentType: string) =>
        apiAuth.post<{ uploadUrl: string; objectKey: string; expiresInSeconds: number }>(`/restaurant-ads/${id}/image/presign`, { contentType }),
    confirmImage: (id: string, objectKey: string, imageAlt: string, rowVersion: number) =>
        apiAuth.post<RestaurantAd>(`/restaurant-ads/${id}/image/confirm`, { objectKey, imageAlt, rowVersion }),
    removeImage: (id: string, rowVersion: number) => apiAuth.post<RestaurantAd>(`/restaurant-ads/${id}/image/remove`, { rowVersion }),
};

export default restaurantAdsApi;
