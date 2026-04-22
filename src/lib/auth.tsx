import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { AuthUser } from "./api";

interface AuthCtx {
  user: AuthUser | null;
  token: string | null;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
  isAdmin: boolean;
  isScorer: boolean;
  canScore: boolean;
}

const Ctx = createContext<AuthCtx | null>(null);

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback; // ✅ FIX

  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
const [user, setUser] = useState<AuthUser | null>(null);
const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const storedUser = load("ca_user", null);
    const storedToken = localStorage.getItem("ca_token");

    setUser(storedUser);
    setToken(storedToken);
  }, []);

  const login = (t: string, u: AuthUser) => {
    setToken(t); setUser(u);
    localStorage.setItem("ca_token", t);
    localStorage.setItem("ca_user", JSON.stringify(u));
  };

  const logout = () => {
    setToken(null); setUser(null);
    localStorage.removeItem("ca_token");
    localStorage.removeItem("ca_user");
  };

  return (
    <Ctx.Provider value={{
      user, token, login, logout,
      isAdmin: user?.role === "admin",
      isScorer: user?.role === "scorer",
      canScore: user?.role === "admin" || user?.role === "scorer",
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}