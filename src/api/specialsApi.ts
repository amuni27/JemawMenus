import apiAuth from "../services/apiAuth.ts";
import type { Special, SpecialPayload } from "../types/special";

// AGF-S2-25 (checkpoint A): the owner's specials (scoped to the signed-in owner's restaurant by the backend).
const specialsApi = {
    list() {
        return apiAuth.get<Special[]>("/specials");
    },
    create(payload: SpecialPayload) {
        return apiAuth.post<Special>("/specials", payload);
    },
    update(id: string, payload: SpecialPayload) {
        return apiAuth.patch<Special>(`/specials/${id}`, payload);
    },
    remove(id: string) {
        return apiAuth.delete(`/specials/${id}`);
    },
};

export default specialsApi;
