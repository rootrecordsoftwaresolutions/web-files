import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import * as Dialog from "@radix-ui/react-dialog";
import { useAuth } from "../../contexts/AuthContext";
import { formatApiError, getMobileVersionPolicy } from "../../lib/api";
import { semverLt } from "../../lib/semverLt";
import { NATIVE_APP_VERSION } from "../../lib/nativeAppVersion";
import { Field } from "../ui/Shell";
import { ShieldCheck } from "lucide-react";

export default function AuthScreen() {
  const nav = useNavigate();
  const { login, register } = useAuth();
  const [mode, setMode] = useState("signin"); // signin | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  /** `{ min, url }` when this build is below server min_version. */
  const [outdated, setOutdated] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await getMobileVersionPolicy();
        if (cancelled || !data?.min_version) return;
        if (!semverLt(NATIVE_APP_VERSION, data.min_version)) return;
        const key = `rrah_update_dismiss_${data.min_version}`;
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

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "signin") await login(email.trim(), password);
      else await register(email.trim(), password, name);
      nav("/home", { replace: true });
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-shell px-5 pt-14 pb-10 min-h-[100dvh] flex flex-col animate-fadein">
      <Dialog.Root open={Boolean(outdated)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-[2px]" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[201] w-[min(92vw,400px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-strong bg-bg-elevated p-5 shadow-xl focus:outline-none">
            <Dialog.Title className="font-heading text-lg font-bold text-ink-primary pr-2">
              Update available
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-ink-secondary leading-relaxed">
              You&apos;re on <span className="font-mono text-ink-primary">v{NATIVE_APP_VERSION}</span>. Install at least{" "}
              <span className="font-mono text-ink-primary">v{outdated?.min}</span> for a supported experience.
            </Dialog.Description>
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                className="btn btn-primary w-full"
                onClick={() => {
                  if (outdated?.url) window.open(outdated.url, "_blank", "noopener,noreferrer");
                }}
              >
                Open Play Store
              </button>
              <button
                type="button"
                className="btn btn-ghost w-full text-ink-secondary"
                onClick={() => {
                  if (outdated?.min) sessionStorage.setItem(`rrah_update_dismiss_${outdated.min}`, "1");
                  setOutdated(null);
                }}
              >
                Continue anyway
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <div className="flex flex-col items-center mb-8">
        <div className="w-14 h-14 rounded-2xl bg-brand/15 border border-brand/30 flex items-center justify-center mb-3">
          <ShieldCheck size={28} className="text-brand" />
        </div>
        <h1 className="font-heading text-2xl font-bold text-ink-primary tracking-tight">
          RootRecord Account Hub
        </h1>
        <p className="text-xs text-ink-secondary mt-1">
          One sign-in for every RootRecord app
        </p>
        <p className="text-xs text-ink-tertiary mt-3 text-center max-w-[320px]">
          Use the same email and password as Weather Manager, Business Manager,
          and the Windows installers. Your plan follows you.
        </p>
      </div>

      <div className="card p-1 flex mb-5" role="tablist">
        <button
          data-testid="auth-tab-signin"
          role="tab"
          aria-selected={mode === "signin"}
          onClick={() => setMode("signin")}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
            mode === "signin" ? "bg-bg-elevated text-ink-primary" : "text-ink-tertiary"
          }`}
        >
          Sign in
        </button>
        <button
          data-testid="auth-tab-signup"
          role="tab"
          aria-selected={mode === "signup"}
          onClick={() => setMode("signup")}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
            mode === "signup" ? "bg-bg-elevated text-ink-primary" : "text-ink-tertiary"
          }`}
        >
          Create account
        </button>
      </div>

      <form onSubmit={submit} noValidate className="card p-4">
        {mode === "signup" && (
          <Field label="Name">
            <input
              data-testid="auth-name-input"
              className="input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="What should we call you?"
              autoComplete="name"
            />
          </Field>
        )}
        <Field label="Email">
          <input
            data-testid="auth-email-input"
            className="input"
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
          />
        </Field>
        <Field
          label="Password"
          hint={mode === "signup" ? "At least 6 characters." : ""}
        >
          <input
            data-testid="auth-password-input"
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            minLength={6}
            required
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
          />
        </Field>

        {error && (
          <p data-testid="auth-error" className="text-sm text-[#FB7185] mb-3">
            {error}
          </p>
        )}

        <button
          data-testid="auth-submit-btn"
          type="submit"
          disabled={busy}
          className="btn btn-primary w-full"
        >
          {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>

      <p className="text-xs text-ink-tertiary text-center mt-auto pt-6">
        Web builds use the account API shard; Android uses the shared primary API.
      </p>
    </div>
  );
}
