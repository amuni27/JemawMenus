import { Category } from "../types/menu";
import { delay, uuid, getData, setData } from "./_utils";

const STORAGE_KEY = "categories";

type CategoryPatch = Partial<Omit<Category, "id" | "menuId" | "createdAt" | "updatedAt">> & {
  sortOrder?: number;
};

function read(): Category[] {
  return getData<Category[]>(STORAGE_KEY, []);
}

function write(data: Category[]) {
  setData(STORAGE_KEY, data);
}

export async function list(menuId: string): Promise<Category[]> {
  await delay();
  return read().filter((c) => c.menuId === menuId).sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function create(menuId: string, name: string): Promise<Category> {
  await delay();
  const cats = read();
  const maxOrder = cats.filter((c) => c.menuId === menuId).reduce((m, c) => Math.max(m, c.sortOrder), 0);
  const now = new Date().toISOString();
  const newCat: Category = {
    id: uuid(),
    menuId,
    name,
    sortOrder: maxOrder + 1,
    createdAt: now,
    updatedAt: now,
  };
  write([...cats, newCat]);
  return newCat;
}

export async function update(id: string, patch: CategoryPatch): Promise<Category | undefined> {
  await delay();
  const cats = read();
  const idx = cats.findIndex((c) => c.id === id);
  if (idx === -1) return undefined;
  cats[idx] = { ...cats[idx], ...patch, updatedAt: new Date().toISOString() };
  write(cats);
  return cats[idx];
}

export async function remove(id: string): Promise<void> {
  await delay();
  const cats = read();
  write(cats.filter((c) => c.id !== id));
}

/**
 * Reorder categories for a menu.
 * @param menuId menu identifier
 * @param orderedIds array with category ids in the desired order
 */
export async function reorder(menuId: string, orderedIds: string[]): Promise<Category[]> {
  await delay();
  const cats = read();
  const byId = new Map(cats.map((c) => [c.id, c]));
  let changed = false;
  orderedIds.forEach((id, idx) => {
    const cat = byId.get(id);
    if (cat && cat.menuId === menuId && cat.sortOrder !== idx) {
      cat.sortOrder = idx;
      cat.updatedAt = new Date().toISOString();
      changed = true;
    }
  });
  if (changed) {
    write([...byId.values()]);
  }
  return read().filter((c) => c.menuId === menuId).sort((a, b) => a.sortOrder - b.sortOrder);
}
