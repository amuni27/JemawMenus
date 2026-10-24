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
import {
    ACCESS_DENIED_EVENT,
    clearStoredSession,
    SESSION_ENDED_EVENT,
    type SessionEndReason,
} from '../../services/session';
import {useToast} from '../../components/ui/ToastContext';

interface AuthContextValue {
    session: AuthSession | null;
    user: UserDTO | null;
    business: BusinessDTO | null;
    isAuthenticated: boolean;
    loading: boolean;
    /** Why the last session ended (expired token or inactive account), for the login redirect (AGF-S1-11) */
    endReason: SessionEndReason | null;
    /** True once the first session check on app start has finished (route guards wait for it) */
    ready: boolean;

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
    const [endReason, setEndReason] = useState<SessionEndReason | null>(null);
    const [ready, setReady] = useState(false);
    const toast = useToast();

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
            setEndReason(null);
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
            setReady(true);
            return;
        }

        setLoading(true);
        try {
            // /me returns a fresh token: store it so the session doesn't end 2 hours after login (AGF-S1-11)
            const { token: freshToken, user, business } = await meService();
            persistSession({ token: freshToken ?? token, user, business });
        } catch (err: any) {
            // End the session on 401 or an inactive account. Route guards decide whether to show login;
            // guest pages are not redirected. Network errors / 5xx should NOT log the user out.
            const status = err?.response?.status;
            const inactive = status === 403 && err?.response?.data?.code === 'ACCOUNT_INACTIVE';
            if (status === 401 || inactive) {
                clearStoredSession();
                persistSession(null);
                setEndReason(inactive ? 'inactive' : 'expired');
            }
        } finally {
            setLoading(false);
            setReady(true);
        }
    }, []);

    useEffect(() => {
        refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Signals from the axios interceptor (services/apiAuth.ts)
    useEffect(() => {
        const onSessionEnded = (e: Event) => {
            const reason = (e as CustomEvent<{ reason: SessionEndReason }>).detail?.reason ?? 'expired';
            setSession(null);
            setEndReason(reason);
        };
        const onAccessDenied = (e: Event) => {
            toast((e as CustomEvent<{ message: string }>).detail?.message ?? "You don't have access to this resource");
        };
        window.addEventListener(SESSION_ENDED_EVENT, onSessionEnded);
        window.addEventListener(ACCESS_DENIED_EVENT, onAccessDenied);
        return () => {
            window.removeEventListener(SESSION_ENDED_EVENT, onSessionEnded);
            window.removeEventListener(ACCESS_DENIED_EVENT, onAccessDenied);
        };
    }, [toast]);


    const value = useMemo(
        () => ({
            session,
            user,
            business,
            isAuthenticated: !!session?.token,
            loading,
            endReason,
            ready,
            login,
            register,
            logout,
            refresh,
        }),
        [session, user, business, loading, endReason, ready, login, register, logout, refresh]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
