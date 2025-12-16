import type { MenuItem, ItemStatus } from "../types/menu";
import { fetchItems, postRequest, deleteRequest } from "../services/apiService";
import {updateItem} from "./menu.ts";

// If your apiService uses PUT for updateRequest, we should add a PATCH helper.
// For now, we'll try to use updateRequest for PATCH-like updates.
// If your backend requires PATCH and updateRequest uses PUT, tell me and I'll give you a patchRequest helper.

type CreateItemBody = Omit<MenuItem, "id" | "menuId" | "createdAt" | "updatedAt">;
type ItemPatch = Partial<CreateItemBody>;

// GET /api/menus/:menuId/items
export function list(menuId: string) {
  return fetchItems(`/menus/${menuId}/items`);
}

// POST /api/menus/:menuId/items
export function create(menuId: string, body: CreateItemBody) {
  return postRequest(`/menus/${menuId}/items`, body);
}

// PATCH or PUT /api/items/:itemId  (adjust if your backend path is different)
export function update(itemId: string, patch: ItemPatch) {
  return updateItem(`/items/${itemId}`, patch);
}

// DELETE /api/items/:itemId
export function remove(itemId: string) {
  return deleteRequest(`/items/${itemId}`);
}

// Update status using same update endpoint
export function updateStatus(itemId: string, status: ItemStatus) {
  return update(itemId, { status });
}
