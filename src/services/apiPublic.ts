// src/services/apiPublic.ts
import axios from "axios";

const apiPublic = axios.create({
    // baseURL: "http://localhost:8080",
    baseURL: "https://jemaw-menu-backend-spring.onrender.com",
});
export default apiPublic