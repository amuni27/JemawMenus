const DOMAIN = "https://agafari-menu.onrender.com/"; // TODO replace with production domain

export function buildMenuUrl(
    businessId: string | undefined,
): string {
  if (!businessId) {
    throw new Error("customSubdomain is required to build menu URL");
  }
  console.log(`${DOMAIN}${businessId}.${DOMAIN}/menu`)

  return `${DOMAIN}${businessId}.${DOMAIN}/menu`;
}
