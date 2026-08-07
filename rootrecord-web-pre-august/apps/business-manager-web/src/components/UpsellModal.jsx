import React, { useEffect, useRef, useState } from "react";
import { ShieldCheck, X } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

const BILLING_URL = "https://rootrecord.info/billing";
const OPENS_KEY = "rrbm.upsell.opens";

/**
 * Free-tier upsell modal — same trigger contract as Weather/Kīlauea:
 *
 *   1. Counter increments by 1 per mount. Opens #2, #4, #6, … show the modal.
 *      Pro/Lifetime never increment.
 *   2. `window.dispatchEvent(new Event("rr.upsell.show"))` forces it open regardless of count.
 */
export const UPSELL_EVENT = "rr.upsell.show";

export default function UpsellModal() {
  const { user } = useAuth();
  const isPro = user?.plan === "pro";
  const [open, setOpen] = useState(false);
  const openCountedRef = useRef(false);

  useEffect(() => {
    if (isPro) {
      setOpen(false);
    }
  }, [isPro]);

  useEffect(() => {
    if (user === undefined || isPro || openCountedRef.current) return;
    openCountedRef.current = true;
    let n = 0;
    try {
      n = Number(window.localStorage.getItem(OPENS_KEY) || "0") + 1;
      window.localStorage.setItem(OPENS_KEY, String(n));
    } catch {
      /* private mode / quota */
    }
    if (n >= 2 && n % 2 === 0) setOpen(true);
  }, [user, isPro]);

  useEffect(() => {
    const on = () => {
      if (user?.plan === "pro") return;
      setOpen(true);
    };
    window.addEventListener(UPSELL_EVENT, on);
    return () => window.removeEventListener(UPSELL_EVENT, on);
  }, [user?.plan]);

  if (!open || isPro) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upsell-title"
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-3 sm:p-6"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={() => setOpen(false)}
      data-testid="upsell-modal"
    >
      <div
        className="w-full max-w-md card border border-subtle rounded-md shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-4 pt-4">
          <div className="flex items-center gap-2 text-brand/80 text-[11px] uppercase tracking-widest">
            <ShieldCheck size={14} /> RootRecord membership
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Dismiss"
            className="text-ink-tertiary hover:opacity-80"
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-4 pb-4 pt-2">
          <h2 id="upsell-title" className="text-lg font-semibold mb-2">
            Some features require additional resources
          </h2>
          <p className="text-sm mb-3">
            Some Business Manager features are limited to members only so we can cover reporting, sync, and desktop access.
          </p>
          <ul className="text-sm space-y-1.5 list-disc pl-5 mb-4">
            <li>Full web portal at <span className="font-mono">business.rootrecord.info</span></li>
            <li>Unlimited PDF reports (free is capped at 3 reports per month)</li>
            <li>Cross-device sync — Android and web stay in lockstep</li>
            <li>One membership supports Weather and Kīlauea features too</li>
          </ul>
          <div className="flex flex-col sm:flex-row gap-2">
            <a
              href={BILLING_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center px-4 py-2 rounded bg-brand text-black font-medium hover:opacity-90"
              data-testid="upsell-upgrade"
            >
              View membership options
            </a>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex-1 inline-flex items-center justify-center px-4 py-2 rounded border border-subtle hover:opacity-80"
              data-testid="upsell-dismiss"
            >
              No thanks
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
