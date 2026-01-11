import type { MenuItem, ItemStatus } from "../types/menu";
import { fetchItems, fetchPublicItems,fetchPublicRequestById, postRequest, deleteRequest, updateRequest } from "../services/apiService";


type CreateItemBody = Omit<MenuItem, "id" | "menuId" | "createdAt" | "updatedAt">;
type ItemPatch = Partial<CreateItemBody>;

export class ItemsApi {
  // GET /apiAuth/menus/:menuId/items
  static list(menuId: string) {
    return fetchItems(`/menus/${menuId}/items`);
  }

  // POST /apiAuth/menus/:menuId/items
  static create(menuId: string, body: CreateItemBody) {
    return postRequest(`/menus/${menuId}/items`, body);
  }

  // PATCH/PUT /apiAuth/items/:itemId
  static update(itemId: string, patch: ItemPatch) {
    return updateRequest(`/items/${itemId}`, patch);
  }

  // DELETE /apiAuth/items/:itemId
  static remove(itemId: string) {
    return deleteRequest(`/items/`,itemId);
  }

  // Update status using same update endpoint
  static updateStatus( itemId: string, body: {status: ItemStatus }) {
    console.log("in side request itemid", itemId)
    return updateRequest(`/items/${itemId}/status`, body);
  }

  static listPublic(businessId: string, menuId: string) {
    return fetchPublicItems(`/${businessId}/menus/${menuId}/items`);
  }

  static listPublicItemById(businessId: string, menuId: string, categoriesId: string) {
    return fetchPublicRequestById(`/${businessId}/menus/${menuId}/items`, categoriesId);
  }
}

export default ItemsApi;
