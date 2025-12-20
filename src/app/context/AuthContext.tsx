// src/app/context/AuthContext.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  login as loginService,
  register as registerService,
  logout as logoutService,
  me as meService,
  type AuthSession,
  type UserDTO,
  type BusinessDTO,
} from '../../services/authService';

interface AuthContextValue {
  session: AuthSession | null;
  user: UserDTO | null;
  business: BusinessDTO | null;
  isAuthenticated: boolean;
  loading: boolean;

  login: (emailOrPhone: string, password: string) => Promise<AuthSession>;
  register: (payload: any) => Promise<AuthSession>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const SESSION_KEY = 'session';
const TOKEN_KEY = 'token';

export function AuthProvider({ children }: { children: ReactNode }) {
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

  const login = async (emailOrPhone: string, password: string) => {
    setLoading(true);
    try {
      const sess = await loginService(emailOrPhone, password); // must return { token, user, business }
      persistSession(sess);
      return sess;
    } finally {
      setLoading(false);
    }
  };

  const register = async (payload: any) => {
    setLoading(true);
    try {
      const sess = await registerService(payload); // must return { token, user, business }
      persistSession(sess as AuthSession);
      return sess;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await logoutService();
     window.location.href ='/auth/login';
      persistSession(null);
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) {
      persistSession(null);
      setLoading(false);
      return;
    }

    const saved = JSON.parse(raw) as AuthSession;
    if (!saved?.token) {
      persistSession(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { user, business } = await meService(); // must use token in Authorization header
      persistSession({ token: saved.token, user, business });
    } catch {
      await logoutService();
      persistSession(null);
    } finally {
      setLoading(false);
    }
  };

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
      [session, user, business, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
