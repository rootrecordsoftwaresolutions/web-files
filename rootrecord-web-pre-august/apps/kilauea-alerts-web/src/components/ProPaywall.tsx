import { useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";

const STRIPE_PRICING_TABLE_ID = "prctbl_1TQJ0kIaRpbMiAovAUe3X3QJ";
const STRIPE_PUBLISHABLE_KEY = "pk_live_51T3sezIaRpbMiAov6SUJgKLGR1igmRGOYg1rY1hKJPAWxLXDgJR7kRNSBSM8sJ2Wat1zuC56iE4TCTyPfqmEfTT600cR21LwYA";
const STRIPE_PRICING_SCRIPT_URL = "https://js.stripe.com/v3/pricing-table.js";
const KILAUEA_PLAY_URL = "https://play.google.com/store/apps/details?id=com.rootrecord.kilauea";

function ensureStripePricingTableScript(): void {
  if (typeof document === "undefined") return;
  if (document.querySelector(`script[src="${STRIPE_PRICING_SCRIPT_URL}"]`)) return;
  const s = document.createElement("script");
  s.src = STRIPE_PRICING_SCRIPT_URL;
  s.async = true;
  document.head.appendChild(s);
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "stripe-pricing-table": {
        "pricing-table-id": string;
        "publishable-key": string;
        "customer-email"?: string;
      };
    }
  }
}

export function ProPaywall(): JSX.Element {
  const auth = useAuth();
  useEffect(() => {
    ensureStripePricingTableScript();
  }, []);
  return (
    <div className="app-root" data-testid="pro-paywall">
      <header className="site-header">
        <div className="site-header-inner">
          <div className="brand-block">
            <div className="brand-kicker">RootRecord membership</div>
            <h1 className="brand-title">Some features require additional resources</h1>
            <p className="brand-sub">
              Some Kīlauea Alerts features are limited to members only. Membership helps cover
              additional locations, alerts, and dashboard resources. The Android app is live on Google Play
              and includes core Volcano access.
            </p>
            <p className="brand-sub" style={{ marginTop: "0.75rem" }}>
              <a href={KILAUEA_PLAY_URL} target="_blank" rel="noopener noreferrer">
                Download Kīlauea Alerts on Google Play
              </a>
            </p>
          </div>
        </div>
      </header>

      <main className="dashboard">
        <section className="panel">
          <h2 className="panel-title">Member features</h2>
          <ul className="panel-list">
            <li>Full web dashboard at <code>kilauea.rootrecord.info</code></li>
            <li>All Big Island locations (free Android is locked to Volcano)</li>
            <li>Unlimited refreshes — same data your Android app gets</li>
            <li>One membership supports Weather, Business, and Kīlauea features across devices</li>
          </ul>
        </section>

        <section className="panel">
          <h2 className="panel-title">Choose a plan</h2>
          <div style={{ paddingTop: "0.25rem" }}>
            {/* Stripe Pricing Table renders into this slot once pricing-table.js loads. */}
            <stripe-pricing-table
              pricing-table-id={STRIPE_PRICING_TABLE_ID}
              publishable-key={STRIPE_PUBLISHABLE_KEY}
              customer-email={auth.email || undefined}
            />
          </div>
        </section>

        <p className="muted" style={{ textAlign: "center", marginTop: "1rem" }}>
          Signed in as <code>{auth.email || "unknown"}</code>.{" "}
          <button
            type="button"
            onClick={() => { void auth.logout(); }}
            data-testid="pro-paywall-signout"
            style={{
              background: "transparent",
              border: 0,
              padding: 0,
              color: "inherit",
              textDecoration: "underline",
              cursor: "pointer",
              font: "inherit",
            }}
          >
            Sign out
          </button>
        </p>
      </main>
    </div>
  );
}
