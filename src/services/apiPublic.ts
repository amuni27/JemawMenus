// src/services/apiPublic.ts
import axios from "axios";

const apiPublic = axios.create({
    baseURL: "http://localhost:8080",
});
export default apiPublic