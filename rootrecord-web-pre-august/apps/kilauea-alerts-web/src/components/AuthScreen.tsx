import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { VISITING_HAWAII_URL } from "./VisitingHawaiiPromo";

// Single source of truth used by every RootRecord web upsell button (also referenced by
// Business Manager's UpsellModal). Keeping it inline here avoids a one-line shared file.
const BILLING_URL = "https://rootrecord.info/billing";
const KILAUEA_PLAY_URL = "https://play.google.com/store/apps/details?id=com.rootrecord.kilauea";

/**
 * kilauea.rootrecord.info landing for signed-out visitors.
 *
 * The Kīlauea web dashboard has member-only features, so the default view is a membership pitch
 * rather than a sign-in form that just leads to ProPaywall.tsx anyway. Existing members can still sign in via the toggle;
 * the form is the same one that lived here before, just collapsed by default.
 */
export function AuthScreen() {
  const { login, signup } = useAuth();
  const [view, setView] = useState<"pitch" | "signin" | "register">("pitch");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res =
        view === "signin"
          ? await login(email, password)
          : await signup(email, password, name.trim() || undefined);
      if (!res.ok) setError(res.detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (view === "pitch") {
    return (
      <div className="auth-shell">
        <div className="auth-card panel">
          <div className="brand-kicker">RootRecord</div>
          <h1 className="auth-title">Kīlauea observatory</h1>
          <p className="muted auth-lead">
            Some Kīlauea web features require additional resources. Some features are limited to members only.
            The Android app is live on Google Play and includes core Volcano access.
          </p>
          <a
            className="btn btn-primary auth-submit"
            href={BILLING_URL}
            data-testid="auth-become-member"
          >
            View membership options
          </a>
          <a
            className="btn btn-secondary auth-submit"
            href={KILAUEA_PLAY_URL}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="auth-kilauea-play-store"
          >
            Get Android App
          </a>
          <p className="muted auth-lead" style={{ marginTop: "1.25rem", marginBottom: "0.5rem", fontSize: "0.9rem" }}>
            <strong style={{ color: "var(--text)" }}>Visiting Hawaiʻi</strong> — our all-island travel guide is coming soon.{" "}
            <a href={VISITING_HAWAII_URL} target="_blank" rel="noopener noreferrer" data-testid="auth-visiting-hawaii-promo">
              Learn more &amp; join the waitlist
            </a>
          </p>
          <p className="muted auth-lead" style={{ textAlign: "center", marginTop: "1rem", marginBottom: 0 }}>
            Already a member?{" "}
            <button
              type="button"
              className="auth-linkish"
              onClick={() => setView("signin")}
              data-testid="auth-show-signin"
            >
              Sign in
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <div className="auth-card panel">
        <div className="brand-kicker">RootRecord</div>
        <h1 className="auth-title">Kīlauea observatory</h1>
        <p className="muted auth-lead">Sign in with your RootRecord account. Same session as Weather and Business web when SSO hostnames are configured.</p>

        <div className="auth-tabs">
          <button type="button" className={view === "signin" ? "auth-tab active" : "auth-tab"} onClick={() => setView("signin")}>
            Sign in
          </button>
          <button type="button" className={view === "register" ? "auth-tab active" : "auth-tab"} onClick={() => setView("register")}>
            Create account
          </button>
        </div>

        <form
          className="auth-form"
          autoComplete="on"
          onSubmit={(ev) => void onSubmit(ev)}
        >
          {view === "register" ? (
            <label className="field">
              <span className="field-label">Name (optional)</span>
              <input
                className="input"
                id="rr-auth-name"
                name="name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
          ) : null}
          <label className="field">
            <span className="field-label">Email</span>
            <input
              className="input"
              id="rr-auth-email"
              name="email"
              type="email"
              required
              autoComplete={view === "signin" ? "username" : "email"}
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">Password</span>
            <input
              className="input"
              id="rr-auth-password"
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete={view === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error ? (
            <div className="auth-error" role="alert">
              {error}
            </div>
          ) : null}
          <button type="submit" className="btn btn-primary auth-submit" disabled={busy}>
            {busy ? "Please wait…" : view === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <p className="muted auth-lead" style={{ textAlign: "center", marginTop: "1rem", marginBottom: 0 }}>
          <button
            type="button"
            className="auth-linkish"
            onClick={() => setView("pitch")}
            data-testid="auth-back-to-pitch"
          >
            ← Back
          </button>
        </p>
      </div>
    </div>
  );
}
