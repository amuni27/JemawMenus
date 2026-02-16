import type { MenuItem, ItemStatus } from "../types/menu";
import {
  fetchItems,
  fetchPublicItems,
  fetchPublicRequestById,
  postRequest,
  deleteRequest,
  updateRequest,
} from "../services/apiService";

type CreateItemBody = Omit<MenuItem, "id" | "menuId" | "createdAt" | "updatedAt">;
type ItemPatch = Partial<CreateItemBody>;

export class ItemsApi {
  static list(menuId: string) {
    return fetchItems(`/menus/${menuId}/items`);
  }

  static create(menuId: string, body: any) {
    return postRequest(`/menus/${menuId}/items`, body);
  }

  static update(itemId: string, patch: ItemPatch) {
    return updateRequest(`/items/${itemId}`, patch);
  }

  static remove(itemId: string) {
    return deleteRequest(`/items/`, itemId);
  }

  static updateStatus(itemId: string, body: { status: ItemStatus }) {
    return updateRequest(`/items/${itemId}/status`, body);
  }

  // ✅ NEW: GET presign for existing item
  static presignImage(itemId: string) {
    return fetchItems(`/items/${itemId}/image/presign`);
  }

  // ✅ NEW: confirm upload (backend HEAD check + returns item with public imageUrl)
  static confirmImage(itemId: string, body: { objectKey: string }) {
    return postRequest(`/items/${itemId}/image/confirm`, body);
  }

  static listPublic(businessId: string, menuId: string) {
    return fetchPublicItems(`/${businessId}/menus/${menuId}/items`);
  }

  static listPublicItemById(businessId: string, menuId: string, categoriesId: string) {
    return fetchPublicRequestById(`/${businessId}/menus/${menuId}/items`, categoriesId);
  }
}

export default ItemsApi;
