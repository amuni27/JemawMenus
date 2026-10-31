import apiPublic from "../services/apiPublic";

// AGF-S2-21: the backend share page for a restaurant. Chat apps read its Open Graph tags (name, logo, description) for
// the link preview; people opening it are sent on to the guest menu. The backend base is the same one the guest menu
// already uses (VITE_API_BASE_URL); no domain is hard-coded here.
export function shareUrl(businessId: string | undefined): string {
    if (!businessId) {
        throw new Error("businessId is required to build the share link");
    }
    const base = String(apiPublic.defaults.baseURL ?? "").replace(/\/+$/, "");
    return `${base}/venue/${encodeURIComponent(businessId)}/share`;
}
