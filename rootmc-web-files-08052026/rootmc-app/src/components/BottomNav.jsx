import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Home, LineChart, Wallet, Gift, MoreHorizontal } from "lucide-react";
import { motion } from "framer-motion";

const items = [
  { to: "/", label: "Home", icon: Home, testId: "nav-home" },
  { to: "/market", label: "Market", icon: LineChart, testId: "nav-market" },
  { to: "/portfolio", label: "Portfolio", icon: Wallet, testId: "nav-portfolio" },
  { to: "/rewards", label: "Rewards", icon: Gift, testId: "nav-rewards" },
  { to: "/more", label: "More", icon: MoreHorizontal, testId: "nav-more" },
];

export default function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 max-w-md mx-auto bg-bg-base/85 backdrop-blur-xl border-t border-white/10"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      data-testid="bottom-nav"
    >
      <ul className="grid grid-cols-5">
        {items.map(({ to, label, icon: Icon, testId }) => {
          const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
          return (
            <li key={to}>
              <NavLink
                to={to}
                data-testid={testId}
                className="relative flex flex-col items-center justify-center py-2.5 gap-0.5 min-h-[56px]"
              >
                <Icon
                  size={20}
                  strokeWidth={active ? 2.4 : 1.8}
                  className={active ? "text-gold" : "text-text-secondary"}
                />
                <span
                  className={`text-[10px] font-mono uppercase tracking-[0.15em] ${
                    active ? "text-white" : "text-text-secondary"
                  }`}
                >
                  {label}
                </span>
                {active && (
                  <motion.span
                    layoutId="nav-dot"
                    className="absolute top-1 h-0.5 w-8 rounded-full bg-gold"
                  />
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
