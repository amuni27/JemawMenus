import api from './api';
import {postRequest} from "./apiService.ts";

export const login = async (emailOrPhone: string, password: string) => {
    const response = await postRequest('/login', {emailOrPhone, password});
    if (response.status === 200) {
        const {accessToken, user} = response.data;
        localStorage.setItem('token', accessToken);
        localStorage.setItem('id', user.id);
        localStorage.setItem('email', user.email);
        localStorage.setItem('role', user.role);
    }
    return response.data.message;
};

export const register = async (userData: any) => {
    return await api.post('/auth/register', userData);
};

export const logout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
};

export const forgotPassword = async (email: string) => {
    console.log(email+"email")
    const response = await postRequest('/user/forgot-password/email', {email});
    return response.data;
}

