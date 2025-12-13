export function resolveTenant(slugFromRoute?: string) {
  const host = window.location.hostname;
  const isLocal = host === 'localhost' || host.match(/\d+\.\d+\.\d+\.\d+/);
  if (isLocal && slugFromRoute) return slugFromRoute;
  // production: assume subdomain. e.g., mytenant.myapp.com
  const parts = host.split('.');
  if (parts.length > 2) {
    return parts[0];
  }
  return undefined;
}
