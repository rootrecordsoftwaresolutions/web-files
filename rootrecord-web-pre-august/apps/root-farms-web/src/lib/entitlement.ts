import { isAuthed } from "./api";

const KEYS = {
  pro: "rrfarms.pro",
  life: "rrfarms.life_member",
} as const;

function storedTruthy(value: unknown): boolean {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function accessFromPayload(data: Record<string, unknown>): { pro: boolean; life: boolean } {
  const raw = data.raw && typeof data.raw === "object" ? (data.raw as Record<string, unknown>) : {};
  const access = data.access && typeof data.access === "object" ? (data.access as Record<string, unknown>) : {};
  const rawAccess = raw.access && typeof raw.access === "object" ? (raw.access as Record<string, unknown>) : {};
  const tier = String(data.tier || data.plan || access.tier || raw.tier || raw.plan || rawAccess.tier || "").trim().toLowerCase();
  const subscriptionStatus = String(data.subscription_status || data.subscriptionStatus || raw.subscription_status || "").trim().toLowerCase();
  const life =
    storedTruthy(data.life_member) ||
    storedTruthy(data.lifeMember) ||
    storedTruthy(data.lifetime_member) ||
    storedTruthy(data.lifetimeMember) ||
    storedTruthy(data.lifetime) ||
    storedTruthy(access.life_member) ||
    storedTruthy(access.lifeMember) ||
    storedTruthy(raw.life_member) ||
    storedTruthy(raw.lifeMember) ||
    storedTruthy(rawAccess.life_member) ||
    storedTruthy(rawAccess.lifeMember) ||
    tier === "life" ||
    tier === "lifetime";
  const pro =
    life ||
    storedTruthy(data.pro_unlocked) ||
    storedTruthy(data.proUnlocked) ||
    storedTruthy(data.pro) ||
    storedTruthy(access.pro_unlocked) ||
    storedTruthy(access.proUnlocked) ||
    storedTruthy(raw.pro_unlocked) ||
    storedTruthy(raw.proUnlocked) ||
    storedTruthy(rawAccess.pro_unlocked) ||
    storedTruthy(rawAccess.proUnlocked) ||
    tier === "pro" ||
    tier === "premium" ||
    tier === "paid" ||
    subscriptionStatus === "active" ||
    subscriptionStatus === "trialing";
  return { pro, life };
}

export function setEntitlementFromAuthPayload(data: Record<string, unknown>): void {
  const access = accessFromPayload(data);
  try {
    localStorage.setItem(KEYS.pro, access.pro ? "1" : "0");
    localStorage.setItem(KEYS.life, access.life ? "1" : "0");
  } catch {
    /* */
  }
  notifyNativeAdsSync();
}

export function clearEntitlement(): void {
  try {
    localStorage.removeItem(KEYS.pro);
    localStorage.removeItem(KEYS.life);
  } catch {
    /* */
  }
  notifyNativeAdsSync();
}

export function hasProAccess(): boolean {
  if (!isAuthed()) return false;
  try {
    return storedTruthy(localStorage.getItem(KEYS.pro)) || storedTruthy(localStorage.getItem(KEYS.life));
  } catch {
    return false;
  }
}

/** Pro or lifetime members — no banner or rewarded ads on mobile. */
export function hasAdFreeAccess(): boolean {
  return hasProAccess();
}

function notifyNativeAdsSync(): void {
  try {
    if (typeof window !== "undefined" && window.RootRecordAds?.sync) {
      window.RootRecordAds.sync();
    }
  } catch {
    /* */
  }
}
