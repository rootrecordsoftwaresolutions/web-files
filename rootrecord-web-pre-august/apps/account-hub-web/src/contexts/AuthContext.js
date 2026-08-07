import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, getToken, setToken, getDeviceId, RR_APP_ID } from "../lib/api";
import { notifyAppSessionStart, ROOTRECORD_ACCOUNT_API_ORIGIN } from "../lib/accountNotifyApi";

const AuthCtx = createContext(null);

function isTransientNetworkError(e) {
  return (
    e?.code === "ERR_NETWORK" ||
    String(e?.message || "").toLowerCase().includes("network error")
  );
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function postWithRetry(url, body) {
  try {
    return await api.post(url, body);
  } catch (e1) {
    if (isTransientNetworkError(e1)) {
      await sleep(650);
      return await api.post(url, body);
    }
    throw e1;
  }
}

function storedTruthy(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function accessFromPayload(data) {
  const raw = data?.raw && typeof data.raw === "object" ? data.raw : {};
  const access = data?.access && typeof data.access === "object" ? data.access : {};
  const rawAccess = raw?.access && typeof raw.access === "object" ? raw.access : {};
  const tier = String(data?.tier || data?.plan || access?.tier || raw?.tier || raw?.plan || rawAccess?.tier || "").trim().toLowerCase();
  const subscriptionStatus = String(data?.subscription_status || data?.subscriptionStatus || raw?.subscription_status || "").trim().toLowerCase();
  const life =
    storedTruthy(data?.life_member) ||
    storedTruthy(data?.lifeMember) ||
    storedTruthy(data?.lifetime_member) ||
    storedTruthy(data?.lifetimeMember) ||
    storedTruthy(data?.lifetime) ||
    storedTruthy(access?.life_member) ||
    storedTruthy(access?.lifeMember) ||
    storedTruthy(raw?.life_member) ||
    storedTruthy(raw?.lifeMember) ||
    storedTruthy(rawAccess?.life_member) ||
    storedTruthy(rawAccess?.lifeMember) ||
    tier === "life" ||
    tier === "lifetime";
  const pro =
    life ||
    storedTruthy(data?.pro_unlocked) ||
    storedTruthy(data?.proUnlocked) ||
    storedTruthy(data?.pro) ||
    storedTruthy(access?.pro_unlocked) ||
    storedTruthy(access?.proUnlocked) ||
    storedTruthy(raw?.pro_unlocked) ||
    storedTruthy(raw?.proUnlocked) ||
    storedTruthy(rawAccess?.pro_unlocked) ||
    storedTruthy(rawAccess?.proUnlocked) ||
    tier === "pro" ||
    tier === "premium" ||
    tier === "paid" ||
    subscriptionStatus === "active" ||
    subscriptionStatus === "trialing";
  return { pro, life };
}

function userFromAuthPayload(data, displayName) {
  const email = String(data.email || "").trim();
  const access = accessFromPayload(data);
  const nm = (displayName && String(displayName).trim()) || email.split("@")[0] || "User";
  return {
    id: String(data.account_id || ""),
    email,
    name: nm,
    plan: access.life ? "life" : access.pro ? "pro" : "free",
    pro_unlocked: access.pro,
    life_member: access.life,
    role: "user",
    created_at: new Date().toISOString(),
    subscription_status: String(data.subscription_status || "none"),
  };
}

function userFromMePayload(data) {
  const email = String(data.email || "").trim();
  const access = accessFromPayload(data);
  const raw = data.raw && typeof data.raw === "object" ? data.raw : {};
  return {
    id: String(data.account_id || raw.account_id || ""),
    email,
    name: email.split("@")[0] || "User",
    plan: access.life ? "life" : access.pro ? "pro" : "free",
    pro_unlocked: access.pro,
    life_member: access.life,
    role: "user",
    created_at: String(raw.account_created_at || new Date().toISOString()),
    subscription_status: String(data.subscription_status || raw.subscription_status || "none"),
  };
}

export function AuthProvider({ children }) {
  // `undefined` = not decided yet (splash); `null` = signed out; object = signed in.
  const [user, setUser] = useState(undefined);

  const refresh = useCallback(async () => {
    const t = getToken();
    if (!t) {
      setUser(null);
      return;
    }
    try {
      const { data } = await api.post("/auth/me");
      setUser(userFromMePayload(data));
    } catch {
      setToken("");
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user) return;
    notifyAppSessionStart({
      apiOrigin: ROOTRECORD_ACCOUNT_API_ORIGIN,
      appId: RR_APP_ID,
      betaTester: false,
      guestId: getDeviceId(),
      getAuthToken: () => getToken(),
    });
  }, [user]);

  // api.js response interceptor dispatches this when the Worker rejects our Bearer with
  // "Invalid or expired session." It already wiped the token; we just need to drop the
  // in-memory user so the AuthScreen re-renders.
  useEffect(() => {
    const onInvalid = () => setUser(null);
    window.addEventListener("rrah.session.invalidated", onInvalid);
    return () => window.removeEventListener("rrah.session.invalidated", onInvalid);
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await postWithRetry("/auth/login", {
      email,
      password,
      device_id: getDeviceId(),
    });
    const tok = data.access_token || data.token;
    if (!tok) throw new Error("No session token returned.");
    setToken(tok);
    const u = userFromAuthPayload(data);
    setUser(u);
    return u;
  }, []);

  const register = useCallback(async (email, password, name) => {
    const { data } = await postWithRetry("/auth/signup", {
      email,
      password,
      device_id: getDeviceId(),
    });
    const tok = data.access_token || data.token;
    if (!tok) throw new Error("No session token returned.");
    setToken(tok);
    const u = userFromAuthPayload(data, name);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      /* best-effort; still clear local */
    }
    setToken("");
    setUser(null);
  }, []);

  const refreshEntitlement = useCallback(async () => {
    const { data } = await api.post("/auth/entitlement", { device_id: getDeviceId() });
    const access = accessFromPayload(data);
    const normalized = {
      ...data,
      plan: access.life ? "life" : access.pro ? "pro" : "free",
      pro_unlocked: access.pro,
      life_member: access.life,
    };
    setUser((prev) =>
      prev
        ? {
            ...prev,
            plan: normalized.plan,
            pro_unlocked: normalized.pro_unlocked,
            life_member: normalized.life_member,
            subscription_status:
              data.subscription_status || prev.subscription_status || "none",
          }
        : prev
    );
    return normalized;
  }, []);

  return (
    <AuthCtx.Provider
      value={{ user, login, register, logout, refresh, refreshEntitlement }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
