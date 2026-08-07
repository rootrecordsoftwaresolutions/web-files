import { useEffect, useState } from "react";
import { isPro, isLifeMember } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";

const BILLING_URL = "https://rootrecord.info/billing";
const KILAUEA_PLAY_URL = "https://play.google.com/store/apps/details?id=com.rootrecord.kilauea";
const OPENS_KEY = "rrkil.upsell.opens";
export const UPSELL_EVENT = "rr.upsell.show";

/**
 * Free-tier upsell modal — same trigger contract as Weather/Business:
 *
 *   1. Counter increments by 1 per mount. Opens #2, #4, #6, … show the modal. Pro/Lifetime
 *      never increment.
 *   2. `window.dispatchEvent(new Event("rr.upsell.show"))` forces it open (used when a free
 *      user tries to pick a non-Volcano location).
 */
export function UpsellModal(): JSX.Element | null {
  const [open, setOpen] = useState(false);
  const auth = useAuth();
  const paid = isPro() || isLifeMember();

  useEffect(() => {
    if (paid) return;
    let n = 0;
    try {
      n = Number(window.localStorage.getItem(OPENS_KEY) || "0") + 1;
      window.localStorage.setItem(OPENS_KEY, String(n));
    } catch {
      /* private mode / quota */
    }
    if (n >= 2 && n % 2 === 0) setOpen(true);
  }, [paid, auth.authed, auth.email]);

  useEffect(() => {
    if (paid) setOpen(false);
  }, [paid]);

  useEffect(() => {
    const on = (): void => {
      if (isPro() || isLifeMember()) return;
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
      onClick={() => setOpen(false)}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
      data-testid="upsell-modal"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 460,
          background: "var(--panel-bg, #16212c)",
          color: "var(--ink-primary, #fff)",
          border: "1px solid var(--panel-border, #2a3a4a)",
          borderRadius: 10,
          padding: "1rem 1.1rem",
          boxShadow: "0 18px 48px rgba(0,0,0,0.45)",
        }}
      >
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            opacity: 0.8,
            marginBottom: 6,
          }}
        >
          RootRecord membership
        </div>
        <h2 id="upsell-title" style={{ fontSize: "1.15rem", margin: "0 0 0.5rem" }}>
          Some features require additional resources
        </h2>
        <p style={{ margin: "0 0 0.75rem", lineHeight: 1.5 }}>
          Some Kīlauea features are limited to members only so we can cover additional locations, alerts, and dashboard resources.
        </p>
        <ul style={{ paddingLeft: "1.25rem", margin: "0 0 0.85rem", lineHeight: 1.5 }}>
          <li>All Big Island locations (free is locked to Volcano)</li>
          <li>
            Full web dashboard at <code>kilauea.rootrecord.info</code>
          </li>
          <li>Unlimited refreshes — same data your Android app gets</li>
          <li>One membership supports Weather and Business features too</li>
          <li>
            Android app is live on{" "}
            <a href={KILAUEA_PLAY_URL} target="_blank" rel="noopener noreferrer">
              Google Play
            </a>
          </li>
        </ul>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <a
            href={BILLING_URL}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="upsell-upgrade"
            style={{
              flex: "1 1 160px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0.55rem 0.85rem",
              borderRadius: 6,
              background: "var(--accent, #ff7847)",
              color: "#000",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            View membership options
          </a>
          <button
            type="button"
            onClick={() => setOpen(false)}
            data-testid="upsell-dismiss"
            style={{
              flex: "1 1 120px",
              padding: "0.55rem 0.85rem",
              borderRadius: 6,
              border: "1px solid var(--panel-border, #2a3a4a)",
              background: "transparent",
              color: "inherit",
              cursor: "pointer",
            }}
          >
            No thanks
          </button>
        </div>
      </div>
    </div>
  );
}
