// Type definitions for menus, categories, items
export interface MenuType {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}
export type Currency = "USD" | "ETB" | (string & {});
// Matches the backend MenuResponse (AGF-S1-14 / AGF-DEF-01): menu type fields are flat
export interface Menu {
  id: string;
  businessId: string;
  name: string;
  menuTypeId?: string;
  menuTypeName?: string;
  /** @deprecated not sent by the API; kept for older callers */
  menuType?: MenuType;
  description?: string | null;
  visibility?: string;
  active?: boolean;
  /** The restaurant's currency (AGF-S2-02) */
  currency?: string;
  createdAt: string;
  updatedAt: string;
}


export interface MenuDto {
  name: string;
  menuTypeId: string;
  description?: string;
  /** Omitted when unknown, so an edit never changes the menu's visibility by accident */
  visibility?: string;
  /** Published state (AGF-S1-15). The API reads `isActive` and returns `active`. */
  isActive?: boolean;
}

export interface Category {
  id: string;
  menuId: string;
  name: string;
  /** Returned by the API as `active` */
  active?: boolean;
  isActive?: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type CreateCategoryDTO = {
  name: string;
  sortOrder?: number;
  isActive?: boolean;
};

// OUT_OF_STOCK: shown to guests as Sold Out, not orderable (AGF-S1-12/S1-13)
export type ItemStatus = "AVAILABLE" | "OUT_OF_STOCK" | "UNAVAILABLE";

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
  /** The restaurant's currency, on public item responses (AGF-S2-02) */
  currency?: string;
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