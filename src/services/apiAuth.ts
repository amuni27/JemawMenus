import axios from 'axios';
import { announceAccessDenied, announceSessionEnded, clearStoredSession } from './session';

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

// Login and register report their own errors in the form
const AUTH_FORM_ENDPOINTS = ['/auth/login', '/auth/register'];

// AGF-S1-11: end the stored session on 401 or an inactive account (backend `code`, AGF-S1-07) and report
// other 403s. No navigation here: route guards send owners to login; guest pages stay where they are.
apiAuth.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error?.response?.status;
        const code = error?.response?.data?.code;
        const url: string = error?.config?.url ?? '';

        if (!AUTH_FORM_ENDPOINTS.some((path) => url.startsWith(path))) {
            if (status === 401) {
                clearStoredSession();
                announceSessionEnded('expired');
            } else if (status === 403 && code === 'ACCOUNT_INACTIVE') {
                clearStoredSession();
                announceSessionEnded('inactive');
            } else if (status === 403) {
                announceAccessDenied();
            }
        }
        return Promise.reject(error);
    }
);


export default apiAuth;
