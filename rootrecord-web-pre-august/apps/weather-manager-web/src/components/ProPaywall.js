import React, { useEffect } from 'react';
import { Monitor, ShieldCheck } from 'lucide-react';
import { session } from '../lib/api';

// Public Stripe IDs — same values served by rootrecord.info/api/site-config and pasted into
// every API shard's wrangler.toml. Safe to ship in the web bundle (publishable key + pricing
// table id are both designed for client-side use). If they ever change, update billing.html
// + every product web app's ProPaywall in one pass.
const STRIPE_PRICING_TABLE_ID = 'prctbl_1TQJ0kIaRpbMiAovAUe3X3QJ';
const STRIPE_PUBLISHABLE_KEY = 'pk_live_51T3sezIaRpbMiAov6SUJgKLGR1igmRGOYg1rY1hKJPAWxLXDgJR7kRNSBSM8sJ2Wat1zuC56iE4TCTyPfqmEfTT600cR21LwYA';
const STRIPE_PRICING_SCRIPT_URL = 'https://js.stripe.com/v3/pricing-table.js';

function ensureStripePricingTableScript() {
  if (typeof document === 'undefined') return;
  if (document.querySelector(`script[src="${STRIPE_PRICING_SCRIPT_URL}"]`)) return;
  const s = document.createElement('script');
  s.src = STRIPE_PRICING_SCRIPT_URL;
  s.async = true;
  document.head.appendChild(s);
}

export default function ProPaywall({ onSignOut }) {
  const email = session.getEmail();

  useEffect(() => {
    ensureStripePricingTableScript();
  }, []);

  return (
    <div
      className="min-h-screen bg-app text-white"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      data-testid="pro-paywall"
    >
      <div className="mx-auto max-w-4xl px-4 py-10 lg:py-16">
        <div className="flex items-center gap-2 text-accent/80 text-xs uppercase tracking-widest mb-3">
          <ShieldCheck className="w-4 h-4" />
          RootRecord membership
        </div>
        <h1 className="text-3xl md:text-4xl font-semibold leading-tight mb-3">
          Some features require additional resources
        </h1>
        <p className="text-sm md:text-base text-neutral-300 max-w-2xl mb-6">
          Some features are limited to members only. Membership helps cover higher-cost weather data,
          alerts, sync, and desktop access. Already a member? Your status refreshes automatically when this page opens.
        </p>

        <div className="rounded-md border border-subtle bg-container p-4 md:p-5 mb-6">
          <div className="text-[11px] uppercase tracking-widest text-accent/70 mb-2 flex items-center gap-2">
            <Monitor className="w-3.5 h-3.5" /> Member features
          </div>
          <ul className="text-sm text-neutral-200 space-y-1.5 list-disc pl-5">
            <li>Full web dashboard at <span className="font-mono text-white">weather.rootrecord.info</span></li>
            <li>Unlimited fresh weather pulls (free is capped at two outside-data refreshes per day)</li>
            <li>Multiple saved locations across all your devices</li>
            <li>Same account works on Android and web</li>
          </ul>
        </div>

        <div className="rounded-md border border-subtle bg-container p-2 md:p-4">
          {/* Stripe Pricing Table renders into this slot once pricing-table.js loads. */}
          <stripe-pricing-table
            pricing-table-id={STRIPE_PRICING_TABLE_ID}
            publishable-key={STRIPE_PUBLISHABLE_KEY}
            customer-email={email || undefined}
          />
        </div>

        <p className="text-xs text-neutral-400 mt-6 text-center">
          Signed in as <span className="font-mono text-neutral-200">{email || 'unknown'}</span>.{' '}
          <button
            type="button"
            onClick={onSignOut}
            className="underline underline-offset-2 hover:text-white"
            data-testid="pro-paywall-signout"
          >
            Sign out
          </button>
        </p>
      </div>
    </div>
  );
}
