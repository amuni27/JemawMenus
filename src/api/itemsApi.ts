import type { MenuItem, ItemStatus } from "../types/menu";
import {
  fetchItems,
  fetchPublicItems,
  fetchPublicRequestById,
  postRequest,
  deleteRequest,
  updateRequest,
  putRequest,
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

  // AGF-S2-09: the menu's sold-out items (owner-scoped; the backend filters by status)
  static listSoldOut(menuId: string) {
    return fetchItems(`/menus/${menuId}/items?status=OUT_OF_STOCK`);
  }

  // AGF-S2-08: every item of the category, in the new order
  static reorder(categoryId: string, orderedIds: string[]) {
    return postRequest(`/categories/${categoryId}/items/reorder`, { orderedIds });
  }

  static remove(itemId: string) {
    return deleteRequest(`/items/`, itemId);
  }

  // Backend maps this endpoint with PUT only (PATCH returned HTTP 500)
  static updateStatus(itemId: string, body: { status: ItemStatus }) {
    return putRequest(`/items/${itemId}/status`, body);
  }

  // ✅ NEW: GET presign for existing item
  // AGF-S1-17: the backend allows JPEG, PNG or WebP and signs this content type into the upload URL
  static presignImage(itemId: string, contentType: string) {
    return fetchItems(`/items/${itemId}/image/presign?contentType=${encodeURIComponent(contentType)}`);
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
