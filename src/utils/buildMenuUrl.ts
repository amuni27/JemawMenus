const DOMAIN = "restaurantmenu.com"; // TODO replace with production domain

export function buildMenuUrl(
    customSubdomain: string | undefined,
    menuId: string
): string {
  if (!customSubdomain) {
    throw new Error("customSubdomain is required to build menu URL");
  }

  return `https://${customSubdomain}.${DOMAIN}/menu/${menuId}`;
}
