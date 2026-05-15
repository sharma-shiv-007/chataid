// Frontend/src/auth/AuthContext.tsx
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import API_BASE from "../config/api";

const API = API_BASE;

// ─── TYPES ────────────────────────────────────────────────────────────────────

export type UserRole = "patient" | "doctor" | "nurse" | "admin";

export interface AuthUser {
  id?: string;
  name: string;
  email: string;
  phone?: string;
  photo?: string;
  role: UserRole;
  hospitalId?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
  isAuthenticated: boolean;
  loading: boolean;
}

// ─── CONTEXT ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<AuthUser | null>(null);
  const [token,   setToken]   = useState<string | null>(() => localStorage.getItem("medicare_token"));
  const [loading, setLoading] = useState(true);

  // On mount: validate the stored token with the backend before restoring auth.
  useEffect(() => {
    const savedToken = localStorage.getItem("medicare_token");
    if (!savedToken) {
      setToken(null);
      setUser(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function validateStoredToken() {
      try {
        const res = await fetch(`${API}/auth/me`, {
          headers: { Authorization: `Bearer ${savedToken}` },
        });

        if (!res.ok) throw new Error("Token invalid");

        const data = await res.json();
        const u = data.user ?? data;
        if (!u) throw new Error("Missing user");

        if (!cancelled) {
          setToken(savedToken);
          setUser({
            ...u,
            id: u.id ?? u._id,
          });
        }
      } catch {
        localStorage.removeItem("medicare_token");
        localStorage.removeItem("medicare_user");
        if (!cancelled) {
          setToken(null);
          setUser(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    validateStoredToken();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = (newToken: string, u: AuthUser) => {
    localStorage.setItem("medicare_token", newToken);
    localStorage.setItem("medicare_user",  JSON.stringify(u));
    setToken(newToken);
    setUser(u);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("medicare_token");
    localStorage.removeItem("medicare_user");
    sessionStorage.clear();
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
