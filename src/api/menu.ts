import { delay, getData, setData, uuid } from './_utils';
import { MenuCategory, MenuItem } from '../types';

const CAT_KEY = 'mock_categories';
const ITEM_KEY = 'mock_items';

function loadCats(): MenuCategory[] {
  return getData<MenuCategory[]>(CAT_KEY, []);
}
function saveCats(list: MenuCategory[]) {
  setData(CAT_KEY, list);
}
function loadItems(): MenuItem[] {
  return getData<MenuItem[]>(ITEM_KEY, []);
}
function saveItems(list: MenuItem[]) {
  setData(ITEM_KEY, list);
}

// Categories
export async function getCategories(tenantId: string): Promise<MenuCategory[]> {
  await delay();
  return loadCats().filter((c) => c.tenantId === tenantId).sort((a,b)=>a.sortOrder-b.sortOrder);
}

export async function createCategory(tenantId: string, name: string): Promise<MenuCategory> {
  await delay();
  const cats = loadCats();
  const sortOrder = cats.filter((c) => c.tenantId === tenantId).length;
  const cat: MenuCategory = { id: uuid(), tenantId, name, sortOrder };
  cats.push(cat);
  saveCats(cats);
  return cat;
}

export async function updateCategory(updated: MenuCategory): Promise<MenuCategory> {
  await delay();
  const cats = loadCats();
  const idx = cats.findIndex((c) => c.id === updated.id);
  cats[idx] = updated;
  saveCats(cats);
  return updated;
}

export async function deleteCategory(id: string): Promise<void> {
  await delay();
  const cats = loadCats();
  saveCats(cats.filter((c) => c.id !== id));
}

export async function reorderCategories(tenantId: string, orderedIds: string[]): Promise<void> {
  await delay();
  const cats = loadCats();
  orderedIds.forEach((id, idx) => {
    const cat = cats.find((c) => c.id === id && c.tenantId === tenantId);
    if (cat) cat.sortOrder = idx;
  });
  saveCats(cats);
}

// Items
export async function getItems(tenantId: string): Promise<MenuItem[]> {
  await delay();
  return loadItems().filter((i) => i.tenantId === tenantId);
}

export async function createItem(item: Omit<MenuItem, 'id'>): Promise<MenuItem> {
  await delay();
  const newItem: MenuItem = { ...item, id: uuid() };
  const items = loadItems();
  items.push(newItem);
  saveItems(items);
  return newItem;
}

export async function updateItem(updated: MenuItem): Promise<MenuItem> {
  await delay();
  const items = loadItems();
  const idx = items.findIndex((i) => i.id === updated.id);
  items[idx] = updated;
  saveItems(items);
  return updated;
}

export async function deleteItem(id: string): Promise<void> {
  await delay();
  const items = loadItems();
  saveItems(items.filter((i) => i.id !== id));
}
