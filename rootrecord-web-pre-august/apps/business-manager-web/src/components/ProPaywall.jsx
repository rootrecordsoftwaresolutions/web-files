import React, { useEffect } from "react";
import { ShieldCheck, Monitor } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

const STRIPE_PRICING_TABLE_ID = "prctbl_1TQJ0kIaRpbMiAovAUe3X3QJ";
const STRIPE_PUBLISHABLE_KEY = "pk_live_51T3sezIaRpbMiAov6SUJgKLGR1igmRGOYg1rY1hKJPAWxLXDgJR7kRNSBSM8sJ2Wat1zuC56iE4TCTyPfqmEfTT600cR21LwYA";
const STRIPE_PRICING_SCRIPT_URL = "https://js.stripe.com/v3/pricing-table.js";

function ensureStripePricingTableScript() {
  if (typeof document === "undefined") return;
  if (document.querySelector(`script[src="${STRIPE_PRICING_SCRIPT_URL}"]`)) return;
  const s = document.createElement("script");
  s.src = STRIPE_PRICING_SCRIPT_URL;
  s.async = true;
  document.head.appendChild(s);
}

export default function ProPaywall() {
  const { user, logout } = useAuth();
  const email = user?.email || "";

  useEffect(() => {
    ensureStripePricingTableScript();
  }, []);

  return (
    <div className="min-h-[100dvh]" data-testid="pro-paywall">
      <div className="mx-auto max-w-4xl px-4 py-10 lg:py-16">
        <div className="text-[11px] uppercase tracking-widest text-brand/80 mb-3 flex items-center gap-2">
          <ShieldCheck size={14} /> RootRecord membership
        </div>
        <h1 className="text-3xl md:text-4xl font-semibold leading-tight mb-3">
          Some features require additional resources
        </h1>
        <p className="text-sm md:text-base text-ink-tertiary max-w-2xl mb-6">
          Some Business Manager features are limited to members only. Membership helps cover sync,
          reporting, and desktop access. Already a member? Your status refreshes automatically when this page opens.
        </p>

        <div className="card p-4 mb-6">
          <div className="text-[11px] uppercase tracking-widest text-brand/70 mb-2 flex items-center gap-2">
            <Monitor size={13} /> Member features
          </div>
          <ul className="text-sm space-y-1.5 list-disc pl-5">
            <li>Full web portal at <span className="font-mono">business.rootrecord.info</span></li>
            <li>Unlimited PDF reports (free is capped at 3 reports per month)</li>
            <li>Cross-device sync — Android and web stay in lockstep</li>
            <li>One membership supports Business, Weather, and Kīlauea features across devices</li>
          </ul>
        </div>

        <div className="card p-2 md:p-4">
          {/* Stripe Pricing Table renders into this slot once pricing-table.js loads. */}
          <stripe-pricing-table
            pricing-table-id={STRIPE_PRICING_TABLE_ID}
            publishable-key={STRIPE_PUBLISHABLE_KEY}
            customer-email={email || undefined}
          />
        </div>

        <p className="text-xs text-ink-tertiary mt-6 text-center">
          Signed in as <span className="font-mono">{email || "unknown"}</span>.{" "}
          <button
            type="button"
            onClick={() => { void logout(); }}
            className="underline underline-offset-2 hover:opacity-80"
            data-testid="pro-paywall-signout"
          >
            Sign out
          </button>
        </p>
      </div>
    </div>
  );
}
