import apiAuth from "../services/apiAuth.ts";
import type { CategorySpecial, CategorySpecialPayload } from "../types/special";

// AGF-S2-36 (checkpoint A): the owner's category specials (scoped to the owner's restaurant by the backend).
const categorySpecialsApi = {
    list() {
        return apiAuth.get<CategorySpecial[]>("/category-specials");
    },
    create(payload: CategorySpecialPayload) {
        return apiAuth.post<CategorySpecial>("/category-specials", payload);
    },
    update(id: string, payload: CategorySpecialPayload) {
        return apiAuth.patch<CategorySpecial>(`/category-specials/${id}`, payload);
    },
    remove(id: string) {
        return apiAuth.delete(`/category-specials/${id}`);
    },
};

export default categorySpecialsApi;
