import {
    fetchItems,
    fetchPublicItems
} from "../services/apiService";


class PublicMenuApiService {
    listMenuTypes(endpoint: string) {
        return fetchPublicItems(endpoint);
    }
    findItem(endpoint: string) {
        return fetchPublicItems(endpoint)
    }
}

const publicMenuApi = new PublicMenuApiService();
export default publicMenuApi;
