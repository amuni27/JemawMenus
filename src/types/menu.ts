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
  menuTypeId?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}


export interface MenuDto {
  name: string;
  menuTypeId: string;
  description?: string;
  visibility: string;
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
  price: number;
  ingredients: string[];   // ✅ matches backend
  description?: string | null;
  imageUrl?: string | null;
  calories?: number | null;
  status?: ItemStatus;
  sortOrder?: number;
  createdAt: string;
  updatedAt: string;
  allergens?: any;   // jsonb
  tags?: any;        // jsonb
  prepTimeMinutes?: number | null;
  spiceLevel?: string | null;
}

export type CreateMenuItemDTO = {
  name: string;
  price: number;
  categoryId: string;
  ingredients: string[];   // ✅ same shape
  description?: string | null;
  imageUrl?: string | null;
  calories?: number | null;
  status?: "AVAILABLE" | "UNAVAILABLE";
};


export type CreateItemPayload = {
  name: string;
  price: number;
  categoryId: string;
  ingredients: string[]; // jsonb array of strings
  description?: string | null;
  imageUrl?: string | null;
  calories?: number | null;
  allergens?: string[] | null;
  tags?: string[] | null;
  isFeatured?: boolean;
  prepTimeMinutes?: number | null;
  spiceLevel?: "NONE" | "MILD" | "MEDIUM" | "HOT" | null;
  status?: ItemStatus;
};

export type WaiterListSnapshot = {
  name: string;
  imageUrl?: string;
  price?: number;      // snapshot of price at time added
  currency?: string;   // snapshot of currency at time added
};

export type WaiterListEntry = {
  itemId: string;
  quantity: number;
  snapshot: WaiterListSnapshot;
};

export type WaiterListMap = Record<string, WaiterListEntry>;