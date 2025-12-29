// src/services/apiPublic.ts
import axios from "axios";

const apiPublic = axios.create({
    baseURL: "https://agafari-menu-backend.onrender.com",
});
export default apiPublic