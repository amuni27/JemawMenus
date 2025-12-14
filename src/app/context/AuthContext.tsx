import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import * as api from '../../api/auth';
import {register} from '../../services/authService.ts'

type Session = Awaited<ReturnType<typeof api.login>>;
interface AuthContextValue {
  session?: Session;
  loading: boolean;
  login: (email: string, password: string) => Promise<Session>;
  register: (
    email: string,
    password: string,
    restaurantName: string,
    address?: string,
    phone?: string,
  ) => Promise<Session>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEY = 'session';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | undefined>(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : undefined;
  });
  const [loading, setLoading] = useState(false);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const sess = await api.login({ email, password });
      setSession(sess);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sess));
      return sess;
    } finally {
      setLoading(false);
    }
  };

  const register = async (
    email: string,
    password: string,
    name: string,
    address?: string,
    phone?: string,
  ) => {
    setLoading(true);
    try {
      const sess = await api.register({ email, password, name, address, phone });
      setSession(sess);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sess));
      return sess;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await api.logout();
      setSession(undefined);
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ session, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
