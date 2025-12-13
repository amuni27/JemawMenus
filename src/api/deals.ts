import { delay, getData, setData, uuid } from './_utils';
import { Deal } from '../types';

const KEY = 'mock_deals';

function load(): Deal[] {
  return getData<Deal[]>(KEY, []);
}
function save(list: Deal[]) {
  setData(KEY, list);
}

export async function listDeals(tenantId: string): Promise<Deal[]> {
  await delay();
  return load().filter((d) => d.tenantId === tenantId);
}

export async function createDeal(deal: Omit<Deal, 'id'>): Promise<Deal> {
  await delay();
  const newDeal: Deal = { ...deal, id: uuid() };
  const list = load();
  list.push(newDeal);
  save(list);
  return newDeal;
}

export async function updateDeal(updated: Deal): Promise<Deal> {
  await delay();
  const list = load();
  const idx = list.findIndex((d) => d.id === updated.id);
  list[idx] = updated;
  save(list);
  return updated;
}

export async function deleteDeal(id: string): Promise<void> {
  await delay();
  const list = load();
  save(list.filter((d) => d.id !== id));
}
