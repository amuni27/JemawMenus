import api from './api';
import {ItemStatus} from "../types/menu.ts"; // import your configured Axios instance

// GET all items
export const fetchItems = (endpoint: string) => {
    return api.get(endpoint);
};

// GET item by ID
export const fetchRequestById = (endpoint: string, id: string | number) => {
    return api.get(`${endpoint}${id}`);
};

// POST: Create new item
export const postRequest = (endpoint: string, data: any) => {
    return api.post(endpoint, data);
};

// PUT: Update item
export const updateRequest = (endpoint: string, data: any) => {
    return api.put(`${endpoint}`, data);
};

// DELETE: Remove item
export const deleteRequest = (endpoint: string,id: string | number) => {
    return api.delete(`${endpoint}${id}`);
};
