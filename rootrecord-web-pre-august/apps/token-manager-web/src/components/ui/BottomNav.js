import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Home, ArrowUpRight, QrCode, History, Settings } from "lucide-react";
import { useWallet } from "../../contexts/WalletContext";
import { useAuth } from "../../contexts/AuthContext";

const TABS = [
  { to: "/dashboard", label: "Home", icon: Home, testid: "nav-home" },
  { to: "/send", label: "Send", icon: ArrowUpRight, testid: "nav-send" },
  { to: "/receive", label: "Receive", icon: QrCode, testid: "nav-receive" },
  { to: "/history", label: "Activity", icon: History, testid: "nav-history" },
  { to: "/settings", label: "Settings", icon: Settings, testid: "nav-settings" },
];

function sideLinkClass(isActive) {
  return `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
    isActive ? "bg-white/5 text-[var(--phos)]" : "text-ink-tertiary hover:bg-white/5 hover:text-ink-secondary"
  }`;
}

/** Mobile: bottom tabs. lg+: left sidebar (web layout). */
export default function BottomNav() {
  const { isConnected } = useWallet();
  const { user } = useAuth();
  const loc = useLocation();
  if (!isConnected) return null;
  if (loc.pathname === "/connect") return null;
  if (loc.pathname === "/auth") return null;
  if (loc.pathname.startsWith("/developer-messages")) return null;
  if (loc.pathname.startsWith("/feedback")) return null;
  if (!user) return null;

  return (
    <>
      <aside
        className="fixed left-0 top-0 z-40 hidden h-full w-56 flex-col border-r border-white/5 bg-[#07090c]/95 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl lg:flex"
        aria-label="Main navigation"
      >
        <div className="px-4 pb-5">
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--phos)]">RootRecord</div>
          <div className="mt-0.5 text-base font-semibold text-ink-primary">Token</div>
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
                  <t.icon size={20} strokeWidth={isActive ? 2.25 : 1.75} className="shrink-0" />
                  <span className="truncate">{t.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>

      <nav
        className="glass-bottom fixed bottom-0 inset-x-0 z-40 lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        data-testid="bottom-nav"
      >
        <div className="page-shell px-2 py-1" style={{ paddingBottom: 0 }}>
          <ul className="flex items-stretch justify-around">
            {TABS.map(({ to, label, icon: Icon, testid }) => (
              <li key={to} className="flex-1">
                <NavLink
                  to={to}
                  data-testid={testid}
                  className={({ isActive }) =>
                    `flex flex-col items-center justify-center gap-1 py-2 min-h-[56px] rounded-xl transition-colors ${
                      isActive ? "text-phos" : "text-ink-tertiary hover:text-ink-secondary"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        size={22}
                        strokeWidth={isActive ? 2.25 : 1.75}
                        fill={isActive ? "currentColor" : "none"}
                        style={isActive ? { fillOpacity: 0.12 } : undefined}
                      />
                      <span className="text-[10px] font-semibold uppercase tracking-widest">{label}</span>
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </>
  );
}
