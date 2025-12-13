import { delay, getData, setData, uuid } from './_utils';
import { Tenant, Plan, SubscriptionStatus } from '../types';

const STORAGE_KEY = 'mock_tenants';

type TenantRecord = Tenant;

function load(): TenantRecord[] {
  return getData<TenantRecord[]>(STORAGE_KEY, []);
}
function save(list: TenantRecord[]) {
  setData(STORAGE_KEY, list);
}

export async function getTenantBySlug(slug: string): Promise<Tenant | undefined> {
  await delay();
  const tenants = load();
  return tenants.find((t) => t.slug === slug);
}

export async function getTenantById(id: string): Promise<Tenant | undefined> {
  await delay();
  const tenants = load();
  return tenants.find((t) => t.id === id);
}

export function getTenantByIdSync(id: string): Tenant | undefined {
  const list = load();
  return list.find((t) => t.id === id);
}

// helper to seed tenant when register is called
export function createTenant(name: string, address?: string, phone?: string): Tenant {
  const slug = name.toLowerCase().replace(/\s+/g, '-');
  const tenant: Tenant = {
    id: uuid(),
    name,
    slug,
    plan: 'starter',
    subscriptionStatus: 'trial',
    location: address ? { address } : undefined,
    contact: phone ? { phone } : undefined,
  } as Tenant;
  const list = load();
  list.push(tenant);
  save(list);
  return tenant;
}
