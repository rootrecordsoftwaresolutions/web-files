import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import {
  confirmPasswordReset,
  getStoredAccountVerified,
  getStoredEmail,
  isAuthed,
  loginRequest,
  logoutRequest,
  requestPasswordReset,
  signupRequest,
  tryHydrateSessionFromCookie,
} from "../lib/api";
import { clearEntitlement } from "../lib/entitlement";
import { notifyFarmsSessionStart, FARMS_APP_ID } from "../lib/sessionNotify";
import { startEarnUsageRewards } from "../lib/earnUsageRewards";
import { apiFetch, getStoredToken } from "../lib/api";

type AuthCtx = {
  decided: boolean;
  email: string;
  authed: boolean;
  guestMode: boolean;
  accountVerified: boolean;
  canPlay: boolean;
  login: (email: string, password: string) => Promise<{ ok: true } | { ok: false; detail: string }>;
  register: (
    email: string,
    password: string,
    name?: string,
  ) => Promise<{ ok: true } | { ok: false; detail: string }>;
  requestPasswordReset: (email: string) => Promise<{ ok: true } | { ok: false; detail: string }>;
  confirmPasswordReset: (
    email: string,
    code: string,
    newPassword: string,
  ) => Promise<{ ok: true } | { ok: false; detail: string }>;
  enterBetaTesterMode: () => void;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [decided, setDecided] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const [guestMode, setGuestMode] = useState(false);
  const [sessionNotified, setSessionNotified] = useState(false);

  const sync = useCallback(() => setEpoch((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await tryHydrateSessionFromCookie();
      if (!cancelled) {
        sync();
        setDecided(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sync]);

  /** No account → play as Beta Tester automatically (local progress only). */
  useEffect(() => {
    if (!decided) return;
    if (isAuthed()) {
      setGuestMode(false);
    } else {
      setGuestMode(true);
    }
  }, [decided, epoch]);

  const authed = isAuthed();
  const accountVerified = authed ? getStoredAccountVerified() : false;
  const canPlay = decided && (authed || guestMode);

  useEffect(() => {
    if (!canPlay || sessionNotified) return;
    notifyFarmsSessionStart(!authed);
    setSessionNotified(true);
  }, [canPlay, sessionNotified, authed]);

  useEffect(() => {
    if (!authed) return undefined;
    const client = {
      post: async (path: string, body: Record<string, unknown>) => {
        const res = await apiFetch(`/api${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error("earn request failed");
        return { data: await res.json() };
      },
    };
    return startEarnUsageRewards(client, {
      appId: FARMS_APP_ID,
      getToken: () => getStoredToken() || "",
    });
  }, [authed]);

  const login = useCallback(
    async (email: string, password: string) => {
      const out = await loginRequest(email, password);
      if (out.ok) {
        setGuestMode(false);
        setSessionNotified(false);
        sync();
      }
      return out;
    },
    [sync],
  );

  const register = useCallback(
    async (email: string, password: string, name?: string) => {
      const out = await signupRequest(email, password, name);
      if (out.ok) {
        setGuestMode(false);
        setSessionNotified(false);
        sync();
      }
      return out;
    },
    [sync],
  );

  const enterBetaTesterMode = useCallback(() => {
    setGuestMode(true);
    clearEntitlement();
    setSessionNotified(false);
    sync();
  }, [sync]);

  const requestReset = useCallback((email: string) => requestPasswordReset(email), []);

  const confirmReset = useCallback(
    async (email: string, code: string, newPassword: string) => {
      const out = await confirmPasswordReset(email, code, newPassword);
      if (out.ok) {
        setGuestMode(false);
        setSessionNotified(false);
        sync();
      }
      return out;
    },
    [sync],
  );

  const logout = useCallback(async () => {
    if (guestMode && !authed) {
      setGuestMode(true);
      setSessionNotified(false);
      sync();
      return;
    }
    await logoutRequest();
    setGuestMode(true);
    setSessionNotified(false);
    sync();
  }, [guestMode, authed, sync]);

  const value = useMemo<AuthCtx>(
    () => ({
      decided,
      email: authed ? getStoredEmail() : "",
      authed,
      guestMode,
      accountVerified,
      canPlay,
      login,
      register,
      requestPasswordReset: requestReset,
      confirmPasswordReset: confirmReset,
      enterBetaTesterMode,
      logout,
    }),
    [
      decided,
      epoch,
      authed,
      guestMode,
      accountVerified,
      canPlay,
      login,
      register,
      requestReset,
      confirmReset,
      enterBetaTesterMode,
      logout,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
