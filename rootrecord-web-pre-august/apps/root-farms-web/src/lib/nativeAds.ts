import { hasAdFreeAccess } from "./entitlement";

declare global {
  interface Window {
    RootRecordAds?: {
      sync?: () => void;
      showRewarded?: () => void;
    };
  }
}

export function isNativeAdsAvailable(): boolean {
  if (hasAdFreeAccess()) return false;
  return typeof window !== "undefined" && typeof window.RootRecordAds?.showRewarded === "function";
}

export function syncNativeAds(): void {
  try {
    window.RootRecordAds?.sync?.();
  } catch {
    /* ignore */
  }
}

/** Resolves when the user earns the reward, dismisses early, or the ad is unavailable. */
export function showRewardedAd(): Promise<"earned" | "dismissed" | "unavailable"> {
  if (!isNativeAdsAvailable()) {
    return Promise.resolve("unavailable");
  }
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: "earned" | "dismissed") => {
      if (settled) return;
      settled = true;
      window.removeEventListener("rr-rewarded-earned", onEarned);
      window.removeEventListener("rr-rewarded-dismissed", onDismiss);
      resolve(result);
    };
    const onEarned = () => finish("earned");
    const onDismiss = () => finish("dismissed");
    window.addEventListener("rr-rewarded-earned", onEarned);
    window.addEventListener("rr-rewarded-dismissed", onDismiss);
    try {
      window.RootRecordAds!.showRewarded!();
    } catch {
      finish("dismissed");
    }
  });
}
