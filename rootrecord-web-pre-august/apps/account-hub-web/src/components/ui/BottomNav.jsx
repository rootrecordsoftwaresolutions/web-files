import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Home, Grid3x3, ShieldCheck, User } from "lucide-react";

const TABS = [
  { to: "/home", label: "Home", icon: Home, testid: "nav-home" },
  { to: "/apps", label: "App links", icon: Grid3x3, testid: "nav-apps" },
  { to: "/security", label: "Security", icon: ShieldCheck, testid: "nav-security" },
  { to: "/account", label: "Account", icon: User, testid: "nav-account" },
];

function sideLinkClass(isActive) {
  return `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
    isActive ? "bg-[var(--bg-elevated)] text-[var(--brand)]" : "text-[var(--ink-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--ink-primary)]"
  }`;
}

/** Mobile: bottom bar. lg+: fixed left rail (desktop portal layout). */
export default function BottomNav() {
  const loc = useLocation();
  if (loc.pathname.startsWith("/auth")) return null;
  if (loc.pathname.startsWith("/developer-messages")) return null;
  if (loc.pathname.startsWith("/feedback")) return null;

  return (
    <>
      <aside
        className="fixed left-0 top-0 z-40 hidden h-full w-56 flex-col border-r border-white/5 bg-[var(--bg-base)]/95 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl lg:flex"
        aria-label="Main navigation"
      >
        <div className="px-4 pb-5">
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--brand)]">RootRecord</div>
          <div className="mt-0.5 text-base font-semibold text-[var(--ink-primary)]">Account</div>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 px-2 pb-6">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              data-testid={`${t.testid}-side`}
              className={({ isActive }) => sideLinkClass(isActive)}
            >
              {({ isActive }) => (
                <>
                  <t.icon size={20} strokeWidth={isActive ? 2.4 : 1.8} className="shrink-0" />
                  <span className="truncate">{t.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>

      <nav
        data-testid="bottom-nav"
        className="fixed bottom-0 left-0 right-0 z-40 glass-bottom lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="page-shell flex items-stretch justify-around">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              data-testid={t.testid}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center gap-1 py-2 min-h-[64px] transition-colors ${
                  isActive ? "text-brand" : "text-ink-tertiary"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <t.icon size={22} strokeWidth={isActive ? 2.4 : 1.8} />
                  <span className="text-[11px] font-semibold tracking-wide">{t.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  );
}
