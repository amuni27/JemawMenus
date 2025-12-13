const DOMAIN = "restaurantmenu.com"; // TODO replace with production domain

export function buildMenuUrl(tenantSlug: string, menuId: string): string {
  return `https://${tenantSlug}.${DOMAIN}/menu/${menuId}`;
}
