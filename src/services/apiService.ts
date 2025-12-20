import apiAuth from './apiAuth.ts';
import apiPublic from './apiPublic.ts'

// GET all items
export const fetchItems = (endpoint: string) => {
    return apiAuth.get(endpoint);
};

// GET item by ID
export const fetchRequestById = (endpoint: string, id: string | number) => {
    return apiAuth.get(`${endpoint}${id}`);
};

// POST: Create new item
export const postRequest = (endpoint: string, data: any) => {
    return apiAuth.post(endpoint, data);
};

// PUT: Update item
export const updateRequest = (endpoint: string, data: any) => {
    return apiAuth.put(`${endpoint}`, data);
};

// DELETE: Remove item
export const deleteRequest = (endpoint: string,id: string | number) => {
    return apiAuth.delete(`${endpoint}${id}`);
};


export const fetchPublicItems = (endpoint: string) => {
    return apiPublic.get(endpoint);
};

// GET item by ID
export const fetchPublicRequestById = (endpoint: string, id: string | number) => {
    return apiPublic.get(`${endpoint}${id}`);
};