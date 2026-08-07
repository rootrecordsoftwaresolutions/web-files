import { useAppStore } from "../store/useAppStore";
import type { TabId } from "../types";

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "home", label: "Home", icon: "🏝️" },
  { id: "explore", label: "Explore", icon: "🧭" },
  { id: "map", label: "Map", icon: "🗺️" },
  { id: "saved", label: "Saved", icon: "❤️" },
  { id: "profile", label: "Profile", icon: "👤" },
];

export function BottomNav() {
  const activeTab = useAppStore((s) => s.activeTab);
  const setTab = useAppStore((s) => s.setTab);

  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`bottom-nav__btn${activeTab === t.id ? " bottom-nav__btn--active" : ""}`}
          onClick={() => setTab(t.id)}
          aria-current={activeTab === t.id ? "page" : undefined}
        >
          <span className="bottom-nav__icon" aria-hidden>
            {t.icon}
          </span>
          {t.label}
        </button>
      ))}
    </nav>
  );
}
