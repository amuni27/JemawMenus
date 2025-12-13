import {
  Menu,
  Category,
  MenuItem,
  ItemStatus,
} from "../types/menu";

// Helper utilities ---------------------------------------------------------
const simulateLatency = async (min = 200, max = 500) =>
  new Promise((res) => setTimeout(res, Math.floor(Math.random() * (max - min)) + min));

const getKey = (key: string) => `hotel_menu_${key}`;

function read<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(getKey(key));
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  localStorage.setItem(getKey(key), JSON.stringify(value));
}

const makeId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).substring(2, 10);

// CRUD helpers -------------------------------------------------------------
function upsertArrayItem<T extends { id: string }>(arr: T[], item: T): T[] {
  const idx = arr.findIndex((i) => i.id === item.id);
  if (idx >= 0) {
    arr[idx] = item;
  } else {
    arr.push(item);
  }
  return arr;
}

function deleteArrayItem<T extends { id: string }>(arr: T[], id: string): T[] {
  return arr.filter((i) => i.id !== id);
}

// API implementation -------------------------------------------------------
export async function listMenus(tenantId: string): Promise<Menu[]> {
  await simulateLatency();
  return read<Menu[]>("menus", []).filter((m) => m.tenantId === tenantId);
}

export async function getMenu(menuId: string): Promise<Menu | undefined> {
  await simulateLatency();
  return read<Menu[]>("menus", []).find((m) => m.id === menuId);
}

export async function createMenu(menu: Omit<Menu, "id" | "createdAt" | "updatedAt">): Promise<Menu> {
  await simulateLatency();
  const menus = read<Menu[]>("menus", []);
  const now = new Date().toISOString();
  const newMenu: Menu = { ...menu, id: makeId(), createdAt: now, updatedAt: now };
  write("menus", [...menus, newMenu]);
  return newMenu;
}

export async function updateMenu(menuId: string, patch: Partial<Menu>): Promise<Menu | undefined> {
  await simulateLatency();
  const menus = read<Menu[]>("menus", []);
  const idx = menus.findIndex((m) => m.id === menuId);
  if (idx === -1) return undefined;
  menus[idx] = { ...menus[idx], ...patch, updatedAt: new Date().toISOString() };
  write("menus", menus);
  return menus[idx];
}

export async function deleteMenu(menuId: string): Promise<void> {
  await simulateLatency();
  const menus = read<Menu[]>("menus", []);
  write("menus", deleteArrayItem(menus, menuId));

  // cascade delete categories & items
  const categories = read<Category[]>("categories", []).filter((c) => c.menuId !== menuId);
  write("categories", categories);
  const items = read<MenuItem[]>("items", []).filter((i) => i.menuId !== menuId);
  write("items", items);
}

export async function listCategories(menuId: string): Promise<Category[]> {
  await simulateLatency();
  return read<Category[]>("categories", []).filter((c) => c.menuId === menuId);
}

export async function getCategory(categoryId: string): Promise<Category | undefined> {
  await simulateLatency();
  return read<Category[]>("categories", []).find((c) => c.id === categoryId);
}

export async function createCategory(category: Omit<Category, "id" | "createdAt" | "updatedAt">): Promise<Category> {
  await simulateLatency();
  const cats = read<Category[]>("categories", []);
  const now = new Date().toISOString();
  const newCat: Category = { ...category, id: makeId(), createdAt: now, updatedAt: now };
  write("categories", [...cats, newCat]);
  return newCat;
}

export async function updateCategory(categoryId: string, patch: Partial<Category>): Promise<Category | undefined> {
  await simulateLatency();
  const cats = read<Category[]>("categories", []);
  const idx = cats.findIndex((c) => c.id === categoryId);
  if (idx === -1) return undefined;
  cats[idx] = { ...cats[idx], ...patch, updatedAt: new Date().toISOString() };
  write("categories", cats);
  return cats[idx];
}

export async function deleteCategory(categoryId: string): Promise<void> {
  await simulateLatency();
  // check items
  const items = read<MenuItem[]>("items", []);
  if (items.some((i) => i.categoryId === categoryId)) {
    throw new Error("Category has items. Delete items first.");
  }
  const cats = read<Category[]>("categories", []);
  write("categories", deleteArrayItem(cats, categoryId));
}

export async function listItems(menuId: string): Promise<MenuItem[]> {
  await simulateLatency();
  return read<MenuItem[]>("items", []).filter((i) => i.menuId === menuId);
}

export async function getItem(itemId: string): Promise<MenuItem | undefined> {
  await simulateLatency();
  return read<MenuItem[]>("items", []).find((i) => i.id === itemId);
}

export async function createItem(item: Omit<MenuItem, "id" | "createdAt" | "updatedAt">): Promise<MenuItem> {
  await simulateLatency();
  const items = read<MenuItem[]>("items", []);
  const now = new Date().toISOString();
  const newItem: MenuItem = { ...item, id: makeId(), createdAt: now, updatedAt: now };
  write("items", [...items, newItem]);
  return newItem;
}

export async function updateItem(itemId: string, patch: Partial<MenuItem>): Promise<MenuItem | undefined> {
  await simulateLatency();
  const items = read<MenuItem[]>("items", []);
  const idx = items.findIndex((i) => i.id === itemId);
  if (idx === -1) return undefined;
  items[idx] = { ...items[idx], ...patch, updatedAt: new Date().toISOString() };
  write("items", items);
  return items[idx];
}

export async function deleteItem(itemId: string): Promise<void> {
  await simulateLatency();
  const items = read<MenuItem[]>("items", []);
  write("items", deleteArrayItem(items, itemId));
}

export async function updateItemStatus(itemId: string, status: ItemStatus): Promise<MenuItem | undefined> {
  return updateItem(itemId, { status });
}