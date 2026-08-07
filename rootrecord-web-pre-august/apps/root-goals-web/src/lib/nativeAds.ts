declare global {
  interface Window {
    RootRecordAds?: {
      sync?: () => void;
      recordAction?: () => void;
    };
  }
}

export function syncNativeAds(): void {
  try {
    window.RootRecordAds?.sync?.();
  } catch {
    /* ignore */
  }
}

export function recordNativeAdAction(): void {
  try {
    window.RootRecordAds?.recordAction?.();
  } catch {
    /* ignore */
  }
}
