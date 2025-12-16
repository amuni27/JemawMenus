// Type definitions for menus, categories, items
export interface MenuType {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}
export type Currency = "USD" | "ETB" | (string & {});
export interface Menu {
  id: string;
  businessId: string;
  name: string;
  menuType: MenuType;
  description?: string;
  currency: Currency;
  createdAt: string;
  updatedAt: string;
}

export interface MenuDto {
  id: string;
  businessId: string;
  name: string;
  menuId: string;
  description?: string;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  menuId: string;
  name: string;
  isActive:true
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type CreateCategoryDTO = {
  name: string;
  sortOrder?: number;
  isActive?: boolean;
};

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