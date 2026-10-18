// Guest menu base URL. VITE_PUBLIC_MENU_BASE_URL overrides it for local runs (e.g. the local demo);
// without it, QR codes and menu links keep pointing at the production frontend.
const DEFAULT_DOMAIN = "https://agafari-menu.onrender.com/"; // TODO replace with production domain

export function buildMenuUrl(
    businessId: string | undefined,
): string {
  if (!businessId) {
    throw new Error("customSubdomain is required to build menu URL");
  }
  const base = import.meta.env.VITE_PUBLIC_MENU_BASE_URL || DEFAULT_DOMAIN;
  const domain = base.endsWith("/") ? base : `${base}/`;

  return `${domain}${businessId}/menu`;
}
