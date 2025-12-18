import type { MenuItem, ItemStatus } from "../types/menu";
import { fetchItems, postRequest, deleteRequest, updateRequest } from "../services/apiService";


type CreateItemBody = Omit<MenuItem, "id" | "menuId" | "createdAt" | "updatedAt">;
type ItemPatch = Partial<CreateItemBody>;

export class ItemsApi {
  // GET /api/menus/:menuId/items
  static list(menuId: string) {
    return fetchItems(`/menus/${menuId}/items`);
  }

  // POST /api/menus/:menuId/items
  static create(menuId: string, body: CreateItemBody) {
    return postRequest(`/menus/${menuId}/items`, body);
  }

  // PATCH/PUT /api/items/:itemId
  static update(itemId: string, patch: ItemPatch) {
    return updateRequest(`/items/${itemId}`, patch);
  }

  // DELETE /api/items/:itemId
  static remove(itemId: string) {
    return deleteRequest(`/items/`,itemId);
  }

  // Update status using same update endpoint
  static updateStatus( itemId: string, body: ItemStatus) {
    console.log("in side request itemid", itemId)
    return updateRequest(`/items/${itemId}/status`, body);
  }
}

export default ItemsApi;
