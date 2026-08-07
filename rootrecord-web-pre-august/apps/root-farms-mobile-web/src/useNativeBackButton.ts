import { useEffect, useRef } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

/** Return true when the hardware back action was handled in-app. */
export function useNativeBackButton(onBack: () => boolean) {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let handle: { remove: () => Promise<void> } | undefined;

    void App.addListener("backButton", () => {
      if (onBackRef.current()) return;
      void App.exitApp();
    }).then((h) => {
      handle = h;
    });

    return () => {
      void handle?.remove();
    };
  }, []);
}
