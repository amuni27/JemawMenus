import {delay, getData, setData, uuid} from './_utils';
import {Tenant} from '../types';

const STORAGE_KEY_BUSINESS = 'business';

type TenantRecord = Tenant;

function load(): Tenant {
  return getData<Tenant>(STORAGE_KEY_BUSINESS, []);
}
function save(tenants: TenantRecord[]) {
  setData(STORAGE_KEY_BUSINESS, tenants);
}

export async function getTenantBySlug(slug: string): Promise<Tenant | undefined> {
  await delay();
  return load();
}

export async function getTenantById(id: string): Promise<Tenant | undefined> {
  await delay();
  console.log("tenant id", id)
  const tenants = load();
  console.log("tenant", tenants)
  return load();
}
