// Type definitions for menus, categories, items
export type MenuType = "FOOD" | "DRINK" | "DESSERT" | "OTHER";
export type Currency = "USD" | "ETB" | (string & {});
export interface Menu {
  id: string;
  tenantId: string;
  name: string;
  type: MenuType;
  description?: string;
  currency: Currency;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  menuId: string;
  name: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type ItemStatus = "AVAILABLE" | "UNAVAILABLE";

export type SpiceLevel = "NONE" | "MILD" | "MEDIUM" | "HOT";

export interface MenuItem {
  id: string;
  menuId: string;
  categoryId: string;
  name: string;
  description?: string;
  price: number;
  calories?: number; // optional
  sku?: string;
  isFeatured?: boolean;
  prepTimeMinutes?: number;
  spiceLevel?: SpiceLevel;
  dietTags?: string[];
  allergens?: string[];
  imageUrl?: string;
  ingredients: string[]; // required, min 1
  status: ItemStatus;
  createdAt: string;
  updatedAt: string;
}