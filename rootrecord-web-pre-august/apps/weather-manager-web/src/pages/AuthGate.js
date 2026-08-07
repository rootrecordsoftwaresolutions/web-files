import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Cloud, ArrowRight, Loader2, ShieldCheck } from 'lucide-react';
import { accessFromPayload, api, session, getMobileVersionPolicy } from '../lib/api';
import { NATIVE_APP_VERSION } from '../lib/nativeAppVersion';
import { semverLt } from '../lib/semverLt';

// Single source of truth for the upgrade CTA — same URL Business Manager and Kīlauea use.
const BILLING_URL = 'https://rootrecord.info/billing';

// Native (Capacitor Android) users get free-tier app-shell access (see App.js `IS_NATIVE`), so
// don't lead with a billing pitch there — the pitch is web-only.
const IS_NATIVE = typeof window !== 'undefined' && Boolean(window?.Capacitor?.isNativePlatform?.());

export default function AuthGate({ onSignedIn }) {
  const navigate = useNavigate();
  // `view` controls the landing experience: `pitch` is the default Pro pitch on web (matches
  // the Kīlauea web AuthScreen pattern — every web dashboard is Pro/Lifetime so we don't bury
  // the upsell behind a sign-in form that 99% of free users will hit ProPaywall through anyway).
  // Existing members tap "Sign in" to flip to the form. Native skips straight to `signin`.
  const [view, setView] = useState(IS_NATIVE ? 'signin' : 'pitch'); // pitch | signin | signup
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  /** `{ min, url }` when this build is below server min_version. */
  const [outdated, setOutdated] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await getMobileVersionPolicy();
        if (cancelled || !data?.min_version) return;
        if (!semverLt(NATIVE_APP_VERSION, data.min_version)) return;
        const key = `rr_wm_update_dismiss_${data.min_version}`;
        if (sessionStorage.getItem(key)) return;
        setOutdated({ min: data.min_version, url: data.update_url || '' });
      } catch {
        /* offline — skip */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const isTransientNetworkError = (e) =>
    e?.code === 'ERR_NETWORK' || String(e?.message || '').toLowerCase().includes('network error');

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!email.trim() || password.length < 6) {
      setErr('Enter an email and a password (6+ characters).');
      return;
    }
    setBusy(true);
    try {
      const fn = view === 'signin' ? api.login : api.signup;
      const doAttempt = async () => fn(email.trim(), password);
      let res;
      try {
        res = await doAttempt();
      } catch (e1) {
        // Common on cold start / flaky connectivity: retry once.
        if (isTransientNetworkError(e1)) {
          await sleep(650);
          res = await doAttempt();
        } else {
          throw e1;
        }
      }
      const { data } = res;
      const tok = data.access_token || data.token;
      if (!tok) throw new Error('No session token returned. Try again.');
      const access = accessFromPayload(data);
      session.setSession(tok, data.email, access.pro, access.life);
      onSignedIn?.();
      navigate('/', { replace: true });
    } catch (e2) {
      const detail = e2?.response?.data?.detail;
      if (isTransientNetworkError(e2)) {
        setErr('Having trouble connecting right now. Please try again in a moment.');
      } else {
        const msg = detail || e2?.message || 'Sign in failed.';
        setErr(String(msg));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-app flex flex-col">
      {outdated ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-5 bg-black/80"
          role="dialog"
          aria-modal="true"
          aria-labelledby="wm-upd-title"
        >
          <div className="w-full max-w-sm bg-container border border-accent/40 rounded-sm p-5 shadow-xl">
            <h2 id="wm-upd-title" className="text-lg font-semibold text-white mb-2">
              Update available
            </h2>
            <p className="text-sm text-accent/85 leading-relaxed mb-1">
              You&apos;re on <span className="font-mono text-white">v{NATIVE_APP_VERSION}</span>. Please install at least{' '}
              <span className="font-mono text-white">v{outdated.min}</span> for a supported experience.
            </p>
            <p className="text-xs text-accent/60 mb-4">Same RootRecord account after you update.</p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                className="bg-accent hover:bg-accentHover text-white py-3 rounded-sm text-sm font-medium"
                onClick={() => {
                  if (outdated.url) window.open(outdated.url, '_blank', 'noopener,noreferrer');
                }}
              >
                Open Play Store
              </button>
              <button
                type="button"
                className="py-2 text-sm text-accent/70 hover:text-accent"
                onClick={() => {
                  sessionStorage.setItem(`rr_wm_update_dismiss_${outdated.min}`, '1');
                  setOutdated(null);
                }}
              >
                Continue anyway
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <div className="flex-1 flex flex-col px-6 pt-4 pb-10 max-w-sm mx-auto w-full animate-slideup">
          <div className="flex flex-col items-center text-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-md bg-accent/10 border border-accent/30 flex items-center justify-center">
              <Cloud strokeWidth={1.5} className="w-6 h-6 text-accent" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight" data-testid="auth-app-title">Weather Manager</h1>
              <p className="text-xs text-accent/70 uppercase tracking-[.2em] font-mono">Forecasts &amp; alerts</p>
            </div>
          </div>

          {view === 'pitch' ? (
            <div data-testid="auth-pitch">
              <div className="flex items-center gap-2 text-accent/80 text-[11px] uppercase tracking-widest mb-3 font-mono">
                <ShieldCheck className="w-3.5 h-3.5" />
                RootRecord membership
              </div>
              <h2 className="text-2xl font-semibold leading-tight mb-3">
                Some Weather features require additional resources.
              </h2>
              <p className="text-sm text-accent/85 leading-relaxed mb-6">
                Some features are limited to members only so we can cover higher-cost weather data,
                alerts, and sync. The Android app still includes core weather access.
              </p>
              <a
                href={BILLING_URL}
                data-testid="auth-become-member"
                className="bg-accent hover:bg-accentHover text-white py-3 rounded-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                View membership options
                <ArrowRight className="w-4 h-4" />
              </a>
              <p className="mt-6 text-[11px] text-accent/70 text-center">
                Already a member?{' '}
                <button
                  type="button"
                  data-testid="auth-show-signin"
                  onClick={() => { setView('signin'); setErr(''); }}
                  className="underline underline-offset-2 hover:text-white"
                >
                  Sign in
                </button>
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 mb-6 text-xs uppercase tracking-widest font-mono border-b border-subtle">
                <button
                  type="button"
                  data-testid="auth-tab-signin"
                  onClick={() => setView('signin')}
                  className={`pb-2 border-b-2 -mb-px text-center ${view === 'signin' ? 'text-white border-accent' : 'text-accent/60 border-transparent'}`}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  data-testid="auth-tab-signup"
                  onClick={() => setView('signup')}
                  className={`pb-2 border-b-2 -mb-px text-center ${view === 'signup' ? 'text-white border-accent' : 'text-accent/60 border-transparent'}`}
                >
                  Create account
                </button>
              </div>

              <form onSubmit={submit} noValidate className="flex flex-col gap-4">
                <label className="block">
                  <span className="text-[11px] uppercase tracking-widest text-accent/70 font-mono">Email</span>
                  <input
                    data-testid="auth-email-input"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="mt-1 w-full bg-container border border-subtle rounded-sm px-3 py-3 outline-none focus:border-accent transition-colors"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] uppercase tracking-widest text-accent/70 font-mono">Password</span>
                  <input
                    data-testid="auth-password-input"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••"
                    className="mt-1 w-full bg-container border border-subtle rounded-sm px-3 py-3 outline-none focus:border-accent transition-colors"
                  />
                </label>

                {err && (
                  <div className="text-xs bg-sev-severe/10 border border-sev-severe/40 text-sev-severe p-2 rounded-sm" data-testid="auth-error">
                    {err}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  data-testid="auth-submit-button"
                  className="bg-accent hover:bg-accentHover text-white py-3 rounded-sm flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-60"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                  {view === 'signin' ? 'Sign in' : 'Create account'}
                </button>
              </form>

              {!IS_NATIVE && (
                <p className="mt-6 text-[11px] text-accent/70 text-center">
                  <button
                    type="button"
                    data-testid="auth-back-to-pitch"
                    onClick={() => { setView('pitch'); setErr(''); }}
                    className="underline underline-offset-2 hover:text-white"
                  >
                    ← Back
                  </button>
                </p>
              )}
            </>
          )}
      </div>
    </div>
  );
}
