/** Capacitor Android: interstitial cadence via `RootRecordAds.recordAction()`. */
export function syncNativeAds() {
  try {
    window.RootRecordAds?.sync?.();
  } catch {
    /* ignore */
  }
}

export function recordNativeAdAction() {
  try {
    window.RootRecordAds?.recordAction?.();
  } catch {
    /* ignore */
  }
}
