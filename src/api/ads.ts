import { delay, getData, setData, uuid } from './_utils';
import { Ad } from '../types';

const KEY = 'mock_ads';

function load(): Ad[] {
  return getData<Ad[]>(KEY, []);
}
function save(list: Ad[]) {
  setData(KEY, list);
}

export async function listAds(tenantId: string): Promise<Ad[]> {
  await delay();
  return load().filter((a) => a.tenantId === tenantId);
}

export async function createAd(ad: Omit<Ad, 'id'>): Promise<Ad> {
  await delay();
  const newAd: Ad = { ...ad, id: uuid() };
  const list = load();
  list.push(newAd);
  save(list);
  return newAd;
}

export async function updateAd(updated: Ad): Promise<Ad> {
  await delay();
  const list = load();
  const idx = list.findIndex((a) => a.id === updated.id);
  list[idx] = updated;
  save(list);
  return updated;
}

export async function deleteAd(id: string): Promise<void> {
  await delay();
  const list = load();
  save(list.filter((a) => a.id !== id));
}
