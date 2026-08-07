import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  getStoredEmail,
  isAuthed,
  loginRequest,
  logoutRequest,
  signupRequest,
  tryHydrateSessionFromCookie,
} from "../lib/api";

type AuthCtx = {
  decided: boolean;
  email: string;
  authed: boolean;
  login: (email: string, password: string) => Promise<{ ok: true } | { ok: false; detail: string }>;
  signup: (email: string, password: string, name?: string) => Promise<{ ok: true } | { ok: false; detail: string }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [decided, setDecided] = useState(false);
  const [email, setEmail] = useState("");
  /** Bumped whenever local session flags change so consumers see fresh `authed`. */
  const [sessionEpoch, setSessionEpoch] = useState(0);

  const syncFromStorage = useCallback(() => {
    setEmail(isAuthed() ? getStoredEmail() : "");
    setSessionEpoch((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await tryHydrateSessionFromCookie();
      if (!cancelled) {
        syncFromStorage();
        setDecided(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [syncFromStorage]);

  const login = useCallback(async (em: string, password: string) => {
    const out = await loginRequest(em, password);
    if (out.ok) syncFromStorage();
    return out;
  }, [syncFromStorage]);

  const signup = useCallback(async (em: string, password: string, name?: string) => {
    const out = await signupRequest(em, password, name);
    if (out.ok) syncFromStorage();
    return out;
  }, [syncFromStorage]);

  const logout = useCallback(async () => {
    await logoutRequest();
    syncFromStorage();
  }, [syncFromStorage]);

  const refresh = useCallback(async () => {
    await tryHydrateSessionFromCookie();
    syncFromStorage();
  }, [syncFromStorage]);

  const value = useMemo<AuthCtx>(
    () => ({
      decided,
      email,
      authed: isAuthed(),
      login,
      signup,
      logout,
      refresh,
    }),
    [decided, email, sessionEpoch, login, logout, refresh, signup],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
