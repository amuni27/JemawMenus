import planApi from "../api/planApi";

// AGF FE-2 (register §49/§50): where an owner lands after signing in without a page to return to. Only the backend decides
// (`selectionRequired`, BE-5a); a failed or slow plan read never blocks sign-in and falls back to Menus, as before.
export const PLAN_CHECK_TIMEOUT_MS = 2500;

export async function landingAfterSignIn(businessId: string): Promise<string> {
    const menus = `/${businessId}/admin/menus`;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), PLAN_CHECK_TIMEOUT_MS); });
    try {
        const res = await Promise.race([planApi.get(), timeout]);
        return res?.data?.visible === true && res.data.selectionRequired === true ? `/${businessId}/admin/plans` : menus;
    } catch {
        return menus;
    } finally {
        clearTimeout(timer);
    }
}
