import { MenuItem, ItemStatus } from "../types/menu";
import { delay, uuid, getData, setData } from "./_utils";

const STORAGE_KEY = "items";

type ItemPatch = Partial<Omit<MenuItem, "id" | "menuId" | "createdAt" | "updatedAt">>;

function read(): MenuItem[] {
  return getData<MenuItem[]>(STORAGE_KEY, []);
}
function write(data: MenuItem[]) {
  setData(STORAGE_KEY, data);
}

export async function list(menuId: string): Promise<MenuItem[]> {
  await delay();
  return read().filter((i) => i.menuId === menuId);
}

export async function create(menuId: string, item: Omit<MenuItem, "id" | "menuId" | "createdAt" | "updatedAt">): Promise<MenuItem> {
  await delay();
  const items = read();
  const now = new Date().toISOString();
  const newItem: MenuItem = { ...item, id: uuid(), menuId, createdAt: now, updatedAt: now } as MenuItem;
  write([...items, newItem]);
  return newItem;
}

export async function update(id: string, patch: ItemPatch): Promise<MenuItem | undefined> {
  await delay();
  const items = read();
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return undefined;
  items[idx] = { ...items[idx], ...patch, updatedAt: new Date().toISOString() };
  write(items);
  return items[idx];
}

export async function remove(id: string): Promise<void> {
  await delay();
  const items = read();
  write(items.filter((i) => i.id !== id));
}

export async function updateStatus(id: string, status: ItemStatus): Promise<MenuItem | undefined> {
  return update(id, { status });
}
