import React, { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { ScreenHeader, PageContainer, Section } from "../ui/Shell";
import { REGISTERED_APPS, UPCOMING_APPS } from "../../lib/apps";
import { api } from "../../lib/api";
import { fmtRelative } from "../../lib/format";
import {
  Cloud,
  Briefcase,
  ShieldCheck,
  MapPin,
  Receipt,
  Wallet,
  Flame,
  ArrowUpRight,
  Check,
} from "lucide-react";

const ICONS = { Cloud, Briefcase, ShieldCheck, MapPin, Receipt, Wallet, Flame };

export default function ConnectedApps() {
  const [serverApps, setServerApps] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get("/me/apps");
        if (!cancelled && Array.isArray(data)) setServerApps(data);
      } catch {
        if (!cancelled) setServerApps(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const mergedApps = REGISTERED_APPS.map((app) => {
    const s = serverApps?.find((x) => x.id === app.appId) || null;
    return { ...app, server: s };
  });

  return (
    <>
      <ScreenHeader
        title="RootRecord apps"
        subtitle="Install links and beta access — same account everywhere"
        back={false}
      />
      <PageContainer>
        <Section title="Available now">
          <div className="p-3 grid grid-cols-1 gap-3">
            {mergedApps.map((app) => (
              <AppCard key={app.id} app={app} />
            ))}
          </div>
        </Section>

        <Section title="Coming soon">
          <div className="p-3 grid grid-cols-1 gap-3">
            {UPCOMING_APPS.map((app) => (
              <AppCard key={app.id} app={app} dimmed />
            ))}
          </div>
        </Section>

        <p
          className="text-xs text-ink-tertiary text-center px-4 mt-2"
          data-testid="apps-footnote"
        >
          <strong className="text-ink-secondary">Business Manager</strong>,{" "}
          <strong className="text-ink-secondary">Weather Manager</strong>, and{" "}
          <strong className="text-ink-secondary">Kīlauea Alerts</strong>: on the web,{" "}
          <span className="font-mono">Open</span> goes to each product subdomain; on Android it tries the installed app, then Google Play. Other betas may use the{" "}
          <a
            className="text-brand font-semibold underline underline-offset-2"
            href="https://rootrecord.info/join-tester-group.html"
            target="_blank"
            rel="noopener noreferrer"
          >
            tester Google Group
          </a>{" "}
          for closed testing (see{" "}
          <a
            className="text-brand font-semibold underline underline-offset-2"
            href="https://rootrecord.info/android-closed-testing.html"
            target="_blank"
            rel="noopener noreferrer"
          >
            Android beta links
          </a>
          ).
          <strong className="text-ink-secondary"> Token Manager</strong> is coming soon.
          Last activity and plan come from <span className="font-mono">GET /api/me/apps</span> when you are signed in.
        </p>
      </PageContainer>
    </>
  );
}

function AppCard({ app, dimmed }) {
  const Icon = ICONS[app.iconKey] || ShieldCheck;
  const isCurrent = app.status === "current";
  const isComingSoon = app.status === "coming_soon";

  function openApp() {
    const isNative =
      typeof Capacitor !== "undefined" &&
      typeof Capacitor.isNativePlatform === "function" &&
      Capacitor.isNativePlatform();
    // Browser / PWA: open the product subdomain in a new tab.
    if (!isNative && app.webOpenUrl && typeof window !== "undefined") {
      try {
        window.open(app.webOpenUrl, "_blank", "noopener,noreferrer");
      } catch {
        /* no-op */
      }
      return;
    }
    // Android WebView: attempt native deep link; if not installed the scheme quietly fails — we
    // don't use window.confirm here since it's blocked in Capacitor WebView.
    if (app.androidScheme && typeof window !== "undefined") {
      try {
        window.location.href = app.androidScheme;
      } catch {
        /* no-op */
      }
      // Fallback: open Google Play closed-testing opt-in after a short delay.
      if (app.playStoreUrl) {
        setTimeout(() => {
          try {
            window.open(app.playStoreUrl, "_blank", "noopener,noreferrer");
          } catch {
            /* no-op */
          }
        }, 900);
      }
    } else if (app.playStoreUrl) {
      window.open(app.playStoreUrl, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div
      data-testid={`app-card-${app.id}`}
      className={`card p-4 flex items-center gap-3 ${
        dimmed ? "opacity-70" : ""
      }`}
      style={{ borderColor: `${app.brand}33` }}
    >
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
        style={{
          background: `${app.brand}22`,
          color: app.brand,
          border: `1px solid ${app.brand}44`,
        }}
      >
        <Icon size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-heading text-base text-ink-primary truncate">
            {app.name}
          </p>
          {isCurrent && (
            <span
              className="chip"
              style={{ background: `${app.brand}22`, color: app.brand, borderColor: `${app.brand}44` }}
              data-testid={`app-card-${app.id}-current-chip`}
            >
              <Check size={12} /> this app
            </span>
          )}
          {isComingSoon && <span className="chip">soon</span>}
        </div>
        <p className="text-xs text-ink-secondary mt-0.5 line-clamp-2">
          {app.tagline}
        </p>
        {app.server?.last_seen_at ? (
          <p className="text-[11px] text-ink-tertiary mt-1">
            Last in-app activity {fmtRelative(app.server.last_seen_at)} · Plan{" "}
            <span className="font-mono">{app.server.entitlement}</span>
          </p>
        ) : null}
      </div>
      {!isCurrent && !isComingSoon && (
        <button
          onClick={openApp}
          data-testid={`app-card-${app.id}-open-btn`}
          className="btn btn-secondary min-h-[40px] px-3 text-sm"
          aria-label={`Open ${app.name}`}
        >
          Open <ArrowUpRight size={14} />
        </button>
      )}
    </div>
  );
}
