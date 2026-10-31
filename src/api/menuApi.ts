import {
  postRequest,
  deleteRequest,
  updateRequest,
  fetchRequestById,
  fetchItems, fetchPublicItems, fetchPublicRequestById,
} from "../services/apiService";

import {Menu, Category, MenuItem, MenuDto} from "../types/menu";

class MenuService {
  // ================= MENUS =================

  listMenus() {
    return fetchItems(`/menus`);
  }

  listMenuTypes() {
    return fetchItems("/menus/type/all");
  }

  getMenu(menuId: string) {
    return fetchRequestById("/menus/", menuId); // -> /menus/{id}
  }

  /** AGF-S2-17: the owner's own menu as guests would see it once published (owner-only endpoint) */
  previewMenu(menuId: string) {
    return fetchItems(`/menus/${menuId}/preview`);
  }

  /** AGF-S2-18: copies the menu with all categories and items into a new, unpublished menu */
  duplicateMenu(menuId: string, name: string) {
    return postRequest(`/menus/${menuId}/duplicate`, { name });
  }

  createMenu(data: MenuDto) {
    return postRequest("/menus", data);
  }

  listPublic(businessId: string) {
    return fetchPublicItems(`/menus/${businessId}`);
  }

  listPublicItemById(businessId: string, menuId: string) {
    return fetchPublicRequestById(`/${businessId}/menus`, menuId);
  }

  updateMenu(menuId: string, data: Partial<Menu>) {
    return updateRequest(`/menus/${menuId}`, data);
  }

  deleteMenu(menuId: string) {
    return deleteRequest("/menus/", menuId); // -> /menus/{id}
  }

  // ================= CATEGORIES =================

  listCategories(menuId: string) {
    return fetchItems(`/menus/${menuId}/categories`);
  }

  getCategory(categoryId: string) {
    return fetchRequestById("/categories/", categoryId); // -> /categories/{id}
  }

  createCategory(data: Omit<Category, "id" | "createdAt" | "updatedAt">) {
    return postRequest("/categories", data);
  }

  updateCategory(categoryId: string, data: Partial<Category>) {
    return updateRequest(`/categories/${categoryId}`, data);
  }

  deleteCategory(categoryId: string) {
    return deleteRequest("/categories/", categoryId);
  }

  // ================= ITEMS =================

  listItems(menuId: string) {
    return fetchItems(`/menus/${menuId}/items`);
  }

  getItem(itemId: string) {
    return fetchRequestById("/items/", itemId); // -> /items/{id}
  }

  createItem(data: Omit<MenuItem, "id" | "createdAt" | "updatedAt">) {
    return postRequest("/items", data);
  }

  updateItem(itemId: string, data: Partial<MenuItem>) {
    return updateRequest(`/items/${itemId}`, data);
  }

  deleteItem(itemId: string) {
    return deleteRequest("/items/", itemId);
  }

}

const menuApi = new MenuService();
export default menuApi;
