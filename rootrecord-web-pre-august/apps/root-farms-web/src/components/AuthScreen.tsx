import { useState } from "react";

import { useAuth } from "../contexts/AuthContext";

type AuthMode = "signin" | "signup";

export function AuthScreen({ onContinueAsBetaTester }: { onContinueAsBetaTester?: () => void }) {
  const auth = useAuth();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [resetCode, setResetCode] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetMsg, setResetMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const out =
        mode === "signin"
          ? await auth.login(email.trim(), password)
          : await auth.register(email.trim(), password, name.trim());
      if (!out.ok) {
        if (mode === "signup" && /already registered|already exists|already in use/i.test(out.detail)) {
          setMode("signin");
          setErr("That email already has a RootRecord account. Use Sign in, or contact support if you need a password reset.");
        } else {
          setErr(out.detail);
        }
      }
    } catch {
      setErr("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <h1>Root Units Idle Farmer</h1>
        <p className="auth-lead">
          {mode === "signup" ? (
            <>
              Create a <strong>rootrecord.info</strong> account to save your farm and Root Units across devices.
            </>
          ) : (
            <>
              Sign in with your <strong>rootrecord.info</strong> account to save progress. Your farm and Root Units sync
              with your account.
            </>
          )}
        </p>

        <AuthModeTabs mode={mode} setMode={setMode} />

        <form onSubmit={submit} className="auth-form">
          {mode === "signup" ? (
            <label>
              Name
              <input
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="What should we call you?"
              />
            </label>
          ) : null}
          <label>
            Email
            <input
              type="email"
              autoComplete="username"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              minLength={6}
              required
            />
            {mode === "signup" ? <span className="auth-field-hint">At least 6 characters.</span> : null}
          </label>
          {err ? (
            <p className="auth-err" role="alert">
              {err}
            </p>
          ) : null}
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        {mode === "signin" ? (
          <div className="auth-reset">
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setResetOpen((v) => !v)}>
              Forgot password?
            </button>
            {resetOpen ? (
              <form
                className="auth-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setErr("");
                  setResetMsg("");
                  setBusy(true);
                  try {
                    const out = await auth.confirmPasswordReset(email.trim(), resetCode.trim(), resetPassword);
                    if (out.ok) {
                      setResetMsg("Password reset. You are signed in.");
                      return;
                    }
                    setErr(out.detail);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <p className="auth-field-hint">
                  Enter your email above, request a reset code, then paste the code from email.
                </p>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={busy || !email.trim()}
                  onClick={async () => {
                    setErr("");
                    setResetMsg("");
                    setBusy(true);
                    try {
                      const out = await auth.requestPasswordReset(email.trim());
                      if (out.ok) setResetMsg("If that account exists, a reset email has been sent.");
                      else setErr(out.detail);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Email reset code
                </button>
                <label>
                  Reset code
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    placeholder="6-digit code"
                  />
                </label>
                <label>
                  New password
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    minLength={6}
                    placeholder="New password"
                  />
                </label>
                {resetMsg ? <p className="auth-field-hint">{resetMsg}</p> : null}
                <button type="submit" className="btn btn-primary" disabled={busy || !resetCode || !resetPassword}>
                  Reset password
                </button>
              </form>
            ) : null}
          </div>
        ) : null}

        <button
          type="button"
          className="btn btn-ghost auth-guest-btn"
          disabled={busy}
          onClick={() => {
            auth.enterBetaTesterMode();
            onContinueAsBetaTester?.();
          }}
        >
          Continue as Beta Tester
        </button>
        <p className="auth-guest-note">
          Don&apos;t want to sign in? Play as a <strong>Beta Tester</strong> — progress stays on this device and is not
          saved to your RootRecord account.
        </p>
        <p className="auth-support-note">Account verification and reset emails come from rootrecord.info.</p>
      </div>
    </div>
  );
}

function AuthModeTabs({ mode, setMode }: { mode: AuthMode; setMode: (m: AuthMode) => void }) {
  return (
    <div className="auth-tabs" role="tablist">
      <button
        type="button"
        role="tab"
        aria-selected={mode === "signin"}
        className={mode === "signin" ? "auth-tab auth-tab--active" : "auth-tab"}
        onClick={() => setMode("signin")}
      >
        Sign in
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === "signup"}
        className={mode === "signup" ? "auth-tab auth-tab--active" : "auth-tab"}
        onClick={() => setMode("signup")}
      >
        Create account
      </button>
    </div>
  );
}
