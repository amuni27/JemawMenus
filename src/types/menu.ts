// Type definitions for menus, categories, items
export interface MenuType {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}
export type Currency = "USD" | "ETB" | (string & {});
// Matches the backend MenuResponse (AGF-S1-14 / AGF-DEF-01): menu type fields are flat
/** AGF-S2-18: response of POST /menus/{id}/duplicate */
export interface MenuDuplicateResult {
  menu: Menu;
  categoriesCopied: number;
  itemsCopied: number;
  imagesNotCopied: number;
}

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

export type SpiceLevel = "NONE" | "MILD" | "MEDIUM" | "HOT" | "EXTRA_HOT";

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
  /** Owner and guest responses name the flag "featured"; "isFeatured" kept for older shapes (AGF-S2-06) */
  featured?: boolean;
  isFeatured?: boolean;
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
  spiceLevel?: string | null;
  /** AGF-S2-30 (edit only): remove a saved prep time / spice level; absent means unchanged */
  clearPrepTime?: boolean;
  clearSpiceLevel?: boolean;
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

/** Shared with the guest item-detail page through the router outlet (AGF-S2-04). */
export interface GuestMenuOutletContext {
  /** Adds an item to the session waiter list (sold-out items are ignored) and confirms with a toast. */
  addToWaiterList: (item: MenuItem) => void;
  /** AGF-S2-17: set in the owner preview; item detail comes from the loaded preview and ordering is off */
  preview?: { findItem: (itemId: string) => MenuItem | undefined; addDisabledLabel: string };
}
