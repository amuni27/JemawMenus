// src/services/authService.ts
import apiAuth from './apiAuth.ts';
import { postRequest } from './apiService';

export type Role = 'OWNER' | 'ADMIN' | 'STAFF';

export interface UserDTO {
    id: string;
    businessId: string;
    email: string;
    role: string;
    phoneNumber: string;
    status: string;
    fullName?: string;
    updatedAt: Date
    createdAt: Date
}

export interface BusinessDTO {
    id: string;
    name: string;
    businessPhone?: string;
    customSubdomain?: string;
    streetAddress?: string;
    city?: string;
    state?: string;
    zipcode?: string;
    ownerUserId?: string;
    open24_7?: boolean;
    logoUrl?: string;
    updatedAt: Date
    createdAt: Date
}

export interface AuthSession {
    token: string;
    user: UserDTO;
    business?: BusinessDTO;
}

function extractSession(data: any): AuthSession | null {
    const token = data?.token ?? data?.accessToken;
    const user = data?.user;
    const business = data?.business ?? data?.vendor; // backward compatibility

    if (!token || !user) return null;
    return { token, user, business };
}

function saveToken(token: string) {
    localStorage.setItem('token', token);
}

export async function login(email: string, password: string): Promise<AuthSession> {
    const res = await postRequest('/auth/login', { email, password });
    const session = extractSession(res.data);
    if (!session) throw new Error(res.data?.message ?? 'Login failed');

    saveToken(session.token);
    return session;
}

export async function register(payload: any): Promise<void> {
    await apiAuth.post("/auth/register", payload);
}

export async function me(): Promise<{ user: UserDTO; business?: BusinessDTO }> {
    const res = await apiAuth.get('/auth/me');
    const data = res.data?.data ?? res.data;
    if (!data?.user) throw new Error('Invalid /me response');

    return {
        user: data.user,
        business: data.business ?? data.vendor,
    };
}

export async function logout(): Promise<void> {
    localStorage.removeItem('token');
    localStorage.removeItem('session')
}
