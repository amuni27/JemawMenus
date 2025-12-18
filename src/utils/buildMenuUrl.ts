const DOMAIN = "restaurantmenu.com"; // TODO replace with production domain

export function buildMenuUrl(customSubdomain: string, menuId: string): string {
  return `https://${customSubdomain}.${DOMAIN}/menu/${menuId}`;
}
