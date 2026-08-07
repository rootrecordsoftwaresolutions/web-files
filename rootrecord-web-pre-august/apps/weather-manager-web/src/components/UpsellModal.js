import React, { useEffect, useState } from 'react';
import { ShieldCheck, X } from 'lucide-react';
import { session } from '../lib/api';
import { BILLING_URL, UPSELL_EVENT } from '../lib/tierAccess';
import useAccess from '../lib/useAccess';

const OPENS_KEY = 'rrwm.upsell.opens';

/**
 * Free-tier upsell modal. Visibility rules:
 *
 *   1. Counter increments by 1 on every app open (one effect run per mount). The first open
 *      never shows the modal; opens #2, #4, #6, … do. Pro/Lifetime never increment.
 *   2. Anywhere in the app can dispatch `window.dispatchEvent(new Event(UPSELL_EVENT))`
 *      to force the modal open regardless of the counter — used to gate Pro-only features.
 *
 * Dismissing only clears local state; the counter is untouched, so the next even-numbered
 * open prompts again as designed.
 */
export { UPSELL_EVENT };

export default function UpsellModal() {
  const [open, setOpen] = useState(false);
  const { pro, life } = useAccess();
  const paid = pro || life;

  useEffect(() => {
    if (paid) return;
    let n = 0;
    try {
      n = Number(window.localStorage.getItem(OPENS_KEY) || '0') + 1;
      window.localStorage.setItem(OPENS_KEY, String(n));
    } catch {
      /* private mode / quota — fall back to in-memory only */
    }
    if (n >= 2 && n % 2 === 0) setOpen(true);
  }, [paid]);

  useEffect(() => {
    if (paid) setOpen(false);
  }, [paid]);

  useEffect(() => {
    const on = () => {
      if (session.isPro() || session.isLifeMember()) return;
      setOpen(true);
    };
    window.addEventListener(UPSELL_EVENT, on);
    return () => window.removeEventListener(UPSELL_EVENT, on);
  }, [paid]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upsell-title"
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-3 sm:p-6"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={() => setOpen(false)}
      data-testid="upsell-modal"
    >
      <div
        className="w-full max-w-md bg-container border border-subtle rounded-md shadow-xl text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-4 pt-4">
          <div className="flex items-center gap-2 text-accent/80 text-[11px] uppercase tracking-widest">
            <ShieldCheck className="w-3.5 h-3.5" /> RootRecord membership
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Dismiss"
            className="text-neutral-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-4 pb-4 pt-2">
          <h2 id="upsell-title" className="text-lg font-semibold mb-2">
            Some features require additional resources
          </h2>
          <p className="text-sm text-neutral-200 mb-3">
            Some features are limited to members only so we can cover higher-cost data, alerts, and sync.
          </p>
          <ul className="text-sm text-neutral-200 space-y-1.5 list-disc pl-5 mb-4">
            <li>Live earthquake, tsunami, cyclone, and wildfire feeds</li>
            <li>Air quality index, pollutants, and forecasts</li>
            <li>NOAA weather alert push notifications on Android</li>
            <li>5-day forecast (free shows 3 days)</li>
            <li>Unlimited fresh updates (free is capped at two outside-data refreshes per day)</li>
            <li>Multiple saved locations synced across all your devices</li>
            <li>One membership supports Business and Kīlauea features too</li>
          </ul>
          <div className="flex flex-col sm:flex-row gap-2">
            <a
              href={BILLING_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center px-4 py-2 rounded bg-accent text-black font-medium hover:opacity-90"
              data-testid="upsell-upgrade"
            >
              View membership options
            </a>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex-1 inline-flex items-center justify-center px-4 py-2 rounded border border-subtle text-neutral-200 hover:bg-white/5"
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
