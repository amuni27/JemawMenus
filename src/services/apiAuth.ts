import axios from 'axios';

const apiAuth = axios.create({
    // VITE_API_BASE_URL overrides the backend for local runs (e.g. the local demo); defaults to production.
    baseURL: `${import.meta.env.VITE_API_BASE_URL ?? 'https://jemaw-menu-backend-spring.onrender.com'}/api`,
});

apiAuth.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);


apiAuth.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error?.response?.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('session');
            window.location.href = '/auth/login';
        }
        return Promise.reject(error);
    }
);


export default apiAuth;
