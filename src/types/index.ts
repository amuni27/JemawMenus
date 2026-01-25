// Core domain models for the QR Menu SaaS
// These types are shared across UI and (later) real API client.

export type ID = string;

// Subscription plans & status
export type Plan = 'starter' | 'pro' | 'enterprise';
export type SubscriptionStatus = 'trial' | 'active' | 'canceled';

// Tags and allergen helpers
export type FoodTag = 'veg' | 'spicy';
export type Allergen =
  | 'gluten'
  | 'peanuts'
  | 'tree_nuts'
  | 'soy'
  | 'dairy'
  | 'eggs'
  | 'fish'
  | 'shellfish';

// Tenant (hotel/restaurant)
export interface Tenant {
  id: string;
  ownerUserId: string;
  name: string;
  businessPhone: string;
  streetAddress: string;
  city: string;
  state: string;
  zipcode: string;
  customSubdomain: string;
  open24_7: boolean;
  createdAt: string;
  updatedAt: string;
}

// Menu
export interface MenuCategory {
  id: ID;
  tenantId: ID;
  name: string;
  sortOrder: number;
}

// export interface MenuItem {
//   id: ID;
//   tenantId: ID;
//   categoryId: ID;
//   name: string;
//   description?: string;
//   price: number;
//   imageUrl?: string;
//   tags?: FoodTag[];
//   allergens?: Allergen[];
//   available: boolean;
// }

export type OptionGroupType = 'single' | 'multiple';

export interface MenuOptionGroup {
  id: ID;
  itemId: ID;
  name: string;
  type: OptionGroupType;
  required: boolean;
}

export interface MenuOption {
  id: ID;
  groupId: ID;
  name: string;
  priceDelta: number; // can be negative for discounts
}

// Deals & Ads
export interface Deal {
  id: ID;
  tenantId: ID;
  title: string;
  description?: string;
  startDate: string; // ISO date
  endDate: string; // ISO date
  active: boolean;
}

export interface Ad {
  id: ID;
  tenantId: ID;
  title: string;
  imageUrl?: string;
  linkUrl?: string;
  startDate: string; // ISO date
  endDate: string; // ISO date
  active: boolean;
}
