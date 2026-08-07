import React, { useMemo, useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Mail, Lock, LogIn, UserPlus } from "lucide-react";
import PageHeader from "../ui/PageHeader";
import { useAuth } from "../../contexts/AuthContext";
import { formatRrApiError, getMobileVersionPolicy } from "../../lib/rrApi";
import { semverLt } from "../../lib/semverLt";
import { NATIVE_APP_VERSION } from "../../lib/nativeAppVersion";

function Field({ icon: Icon, type = "text", value, onChange, placeholder, testid }) {
  return (
    <label className="card p-3 flex items-center gap-3" data-testid={testid}>
      <Icon size={16} className="text-ink-tertiary" />
      <input
        className="w-full bg-transparent outline-none text-ink-primary placeholder:text-ink-tertiary"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoCapitalize="none"
        autoCorrect="off"
      />
    </label>
  );
}

export default function AuthScreen() {
  const { user, login, register } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  const from = useMemo(() => (loc.state && loc.state.from ? String(loc.state.from) : "/connect"), [loc.state]);

  const [mode, setMode] = useState("login"); // 'login' | 'signup'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  /** `{ min, url }` when this build is below server min_version. */
  const [outdated, setOutdated] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await getMobileVersionPolicy();
        if (cancelled || !data?.min_version) return;
        if (!semverLt(NATIVE_APP_VERSION, data.min_version)) return;
        const key = `rrtm_update_dismiss_${data.min_version}`;
        if (sessionStorage.getItem(key)) return;
        setOutdated({ min: data.min_version, url: data.update_url || "" });
      } catch {
        /* offline — skip */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (user) {
    // already signed in
    nav(from, { replace: true });
    return null;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      if (mode === "login") await login(email.trim(), password);
      else await register(email.trim(), password);
      nav(from, { replace: true });
    } catch (e2) {
      setErr(formatRrApiError(e2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-shell" data-testid="auth-screen">
      {outdated && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-[2px]"
          role="presentation"
        >
          <div className="card w-full max-w-md p-5 space-y-4 shadow-xl border border-white/10" role="dialog" aria-modal="true">
            <h2 className="text-lg font-bold text-ink-primary">Update available</h2>
            <p className="text-sm text-ink-secondary leading-relaxed">
              You&apos;re on <span className="font-mono text-ink-primary">v{NATIVE_APP_VERSION}</span>. Install at least{" "}
              <span className="font-mono text-ink-primary">v{outdated.min}</span> for a supported experience.
            </p>
            <button
              type="button"
              className="btn btn-primary w-full"
              onClick={() => {
                if (outdated.url) window.open(outdated.url, "_blank", "noopener,noreferrer");
              }}
            >
              Open Play Store
            </button>
            <button
              type="button"
              className="btn btn-secondary w-full"
              onClick={() => {
                sessionStorage.setItem(`rrtm_update_dismiss_${outdated.min}`, "1");
                setOutdated(null);
              }}
            >
              Continue anyway
            </button>
          </div>
        </div>
      )}
      <PageHeader title="Sign in" subtitle="RootRecord account" />

      <div className="px-4 pt-4 space-y-3">
        <div className="card p-2 flex gap-2" role="tablist" aria-label="Auth mode">
          <button
            className={`flex-1 btn ${mode === "login" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setMode("login")}
            type="button"
            data-testid="auth-tab-login"
          >
            <LogIn size={16} /> Sign in
          </button>
          <button
            className={`flex-1 btn ${mode === "signup" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setMode("signup")}
            type="button"
            data-testid="auth-tab-signup"
          >
            <UserPlus size={16} /> Create
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <Field
            icon={Mail}
            value={email}
            onChange={setEmail}
            placeholder="email@domain.com"
            testid="auth-email"
          />
          <Field
            icon={Lock}
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="Password"
            testid="auth-password"
          />

          {err ? (
            <div className="card p-3 text-sm text-red-200 bg-red-500/10 border border-red-400/20" data-testid="auth-error">
              {err}
            </div>
          ) : null}

          <button className="btn btn-primary w-full" disabled={busy || !email || !password} data-testid="auth-submit">
            {busy ? "Working…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <div className="text-center text-[11px] text-ink-tertiary pt-1">
          Your wallet stays non‑custodial. RootRecord login is used for account-wide settings and future cross‑app features.
        </div>
      </div>
    </div>
  );
}

