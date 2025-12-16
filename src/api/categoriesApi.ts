import {
  fetchItems,
  postRequest,
  deleteRequest,
} from "../services/apiService";
import api from "../services/api";
import {Category, CreateCategoryDTO} from "../types/menu";

class CategoryService {
  // ================= CATEGORIES =================

  // GET /api/menus/:menuId/categories
  getCategories(menuId: string) {
    return fetchItems(`/menus/${menuId}/categories`);
  }

  // POST /api/menus/:menuId/categories
  createCategory(menuId: string, body: CreateCategoryDTO) {
    return postRequest(`/menus/${menuId}/categories`, body);
  }

  // PATCH /api/categories/:categoryId
  updateCategory(
      categoryId: string,
      data: Partial<Pick<Category, "name" | "sortOrder" | "isActive">>
  ) {
    return api.patch<Category>(`/categories/${categoryId}`, data);
  }

  // DELETE /api/categories/:categoryId
  deleteCategory(categoryId: string) {
    return deleteRequest(`/categories/`, categoryId);
  }

  // POST /api/menus/:menuId/categories/reorder
  reorderCategories(menuId: string, orderedIds: string[]) {
    return postRequest(`/menus/${menuId}/categories/reorder`, { orderedIds });
  }
}

// Export a singleton (recommended)
export const categoryService = new CategoryService();

// Or export the class if you prefer manual instantiation
export default categoryService;


