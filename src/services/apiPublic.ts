// src/services/apiPublic.ts
import axios from "axios";

const apiPublic = axios.create({
    baseURL: "http://localhost:3000",
});
export default apiPublic