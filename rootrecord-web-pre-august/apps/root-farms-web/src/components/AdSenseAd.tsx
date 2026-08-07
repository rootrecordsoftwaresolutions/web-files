import { useEffect, useRef, useState } from "react";

const DEFAULT_ADSENSE_CLIENT = "ca-pub-8245496571119619";
const DEFAULT_ROOT_FARMS_SLOT = "5934995759";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

type Placement = "top" | "bottom";

function slotForPlacement(placement: Placement): string {
  const fallback = import.meta.env.VITE_ADSENSE_ROOT_FARMS_SLOT?.trim() || DEFAULT_ROOT_FARMS_SLOT;
  if (placement === "top") return import.meta.env.VITE_ADSENSE_ROOT_FARMS_TOP_SLOT?.trim() || fallback;
  return import.meta.env.VITE_ADSENSE_ROOT_FARMS_BOTTOM_SLOT?.trim() || fallback;
}

export function AdSenseAd({ placement }: { placement: Placement }) {
  const client = import.meta.env.VITE_ADSENSE_CLIENT?.trim() || DEFAULT_ADSENSE_CLIENT;
  const slot = slotForPlacement(placement);
  const unitRef = useRef<HTMLModElement | null>(null);
  const pushedRef = useRef(false);
  const [state, setState] = useState<"loading" | "filled" | "hidden">("loading");

  useEffect(() => {
    if (!slot || typeof window === "undefined" || !unitRef.current) return;
    setState("loading");
    const unit = unitRef.current;
    const updateFromAdStatus = () => {
      const status = unit.getAttribute("data-ad-status");
      if (status === "filled") setState("filled");
      if (status === "unfilled") setState("hidden");
    };

    const observer = new MutationObserver(updateFromAdStatus);
    observer.observe(unit, { attributes: true, attributeFilter: ["data-ad-status"] });

    try {
      if (!pushedRef.current) {
        pushedRef.current = true;
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      }
    } catch {
      // Ad blockers or an unavailable AdSense script should never affect gameplay.
      setState("hidden");
    }

    const timeout = window.setTimeout(() => {
      const status = unit.getAttribute("data-ad-status");
      if (status === "unfilled") setState("hidden");
      else if (status === "filled") setState("filled");
      else setState("hidden");
    }, 4500);

    return () => {
      window.clearTimeout(timeout);
      observer.disconnect();
    };
  }, [slot]);

  if (!slot) return null;

  return (
    <aside className={`ad-shell ad-shell--${placement} ad-shell--${state}`} aria-label="Advertisement">
      <span className="ad-label">Advertisement</span>
      <ins
        ref={unitRef}
        className="adsbygoogle ad-unit"
        style={{ display: "block" }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}
