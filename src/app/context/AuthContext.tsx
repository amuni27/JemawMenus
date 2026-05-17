// src/app/context/AuthContext.tsx
import type {ReactNode} from 'react';
import React, {createContext, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import {
    type AuthSession,
    type BusinessDTO,
    login as loginService,
    logout as logoutService,
    me as meService,
    register as registerService,
    type UserDTO,
} from '../../services/authService';

interface AuthContextValue {
    session: AuthSession | null;
    user: UserDTO | null;
    business: BusinessDTO | null;
    isAuthenticated: boolean;
    loading: boolean;

    login: (emailOrPhone: string, password: string) => Promise<AuthSession>;
    register: (payload: any) => Promise<void>;
    logout: () => Promise<void>;
    refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const SESSION_KEY = 'session';
const TOKEN_KEY = 'token';

export function AuthProvider({children}: { children: ReactNode }) {
    const [session, setSession] = useState<AuthSession | null>(() => {
        const raw = localStorage.getItem(SESSION_KEY);
        return raw ? (JSON.parse(raw) as AuthSession) : null;
    });

    const [loading, setLoading] = useState(true);

    const user = session?.user ?? null;
    const business = session?.business ?? null;

    const persistSession = (session: AuthSession | null) => {
        setSession(session);

        if (session?.token) {
            localStorage.setItem(SESSION_KEY, JSON.stringify(session));
            localStorage.setItem(TOKEN_KEY, session.token);
        } else {
            localStorage.removeItem(SESSION_KEY);
            localStorage.removeItem(TOKEN_KEY);
        }
    };

    const login = useCallback(async (emailOrPhone: string, password: string) => {
        setLoading(true);
        try {
            const sess = await loginService(emailOrPhone, password);
            persistSession(sess);
            return sess;
        } finally {
            setLoading(false);
        }
    }, []);

    const register = useCallback(async (payload: any): Promise<void> => {
        setLoading(true);
        try {
            await registerService(payload);
        } finally {
            setLoading(false);
        }
    }, []);

    const logout = useCallback(async () => {
        setLoading(true);
        try {
            await logoutService();
            persistSession(null);
            window.location.href = '/auth/login';
        } finally {
            setLoading(false);
        }
    }, []);

    const refresh = useCallback(async () => {
        const token = localStorage.getItem(TOKEN_KEY);
        if (!token) {
            persistSession(null);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const { user, business } = await meService();
            persistSession({ token, user, business });
        } catch (err: any) {
            // Only clear the session on 401 — the axios interceptor already
            // redirects, but we also clear React state here.
            // Network errors / 5xx should NOT log the user out.
            if (err?.response?.status === 401) {
                await logoutService();
                persistSession(null);
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);


    const value = useMemo(
        () => ({
            session,
            user,
            business,
            isAuthenticated: !!session?.token,
            loading,
            login,
            register,
            logout,
            refresh,
        }),
        [session, user, business, loading, login, register, logout, refresh]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
