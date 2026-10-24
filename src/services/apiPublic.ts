// src/services/apiPublic.ts
import axios from "axios";

const apiPublic = axios.create({
    // VITE_API_BASE_URL overrides the backend for local runs (e.g. the local demo); defaults to production.
    baseURL: import.meta.env.VITE_API_BASE_URL ?? "https://jemaw-menu-backend-spring.onrender.com",
});
export default apiPublic