import {
  fetchItems,
  postRequest,
  deleteRequest, fetchPublicItems, fetchPublicRequestById,
} from "../services/apiService";
import apiAuth from "../services/apiAuth.ts";
import {Category, CreateCategoryDTO} from "../types/menu";

class CategoryService {
  // ================= CATEGORIES =================

  // GET /apiAuth/menus/:menuId/categories
  getCategories(menuId: string) {
    return fetchItems(`/menus/${menuId}/categories`);
  }

  // POST /apiAuth/menus/:menuId/categories
  createCategory(menuId: string, body: CreateCategoryDTO) {
    return postRequest(`/menus/${menuId}/categories`, body);
  }

  // PATCH /apiAuth/categories/:categoryId
  updateCategory(
      categoryId: string,
      data: Partial<Pick<Category, "name" | "sortOrder" | "isActive">>
  ) {
    return apiAuth.patch<Category>(`/categories/${categoryId}`, data);
  }

  // DELETE /apiAuth/categories/:categoryId
  deleteCategory(categoryId: string) {
    return deleteRequest(`/categories/`, categoryId);
  }

  // POST /apiAuth/menus/:menuId/categories/reorder
  reorderCategories(menuId: string, orderedIds: string[]) {
    return postRequest(`/menus/${menuId}/categories/reorder`, { orderedIds });
  }

  listPublic(businessId: string, menuId: string) {
    return fetchPublicItems(`/${businessId}/menus/${menuId}/categories`);
  }

  listPublicItemById(businessId: string, menuId: string, categoriesId: string) {
    return fetchPublicRequestById(`/${businessId}/menus/${menuId}/categories`, categoriesId);
  }
}

// Export a singleton (recommended)
export const categoryService = new CategoryService();

// Or export the class if you prefer manual instantiation
export default categoryService;


