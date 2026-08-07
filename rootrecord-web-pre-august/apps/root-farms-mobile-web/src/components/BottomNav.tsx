import type { TabId } from "@core/game/types";

const TABS: { id: TabId; label: string; soon?: boolean }[] = [
  { id: "plots", label: "Plots" },
  { id: "farmhands", label: "Farmhands" },
  { id: "guide", label: "Guide" },
  { id: "leaderboard", label: "Economy" },
  { id: "replant", label: "Replant", soon: true },
  { id: "settings", label: "Settings" },
];

export function BottomNav({ tab, onTab }: { tab: TabId; onTab: (t: TabId) => void }) {
  return (
    <nav className="bottom-nav" aria-label="Main">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`bottom-nav-btn${tab === t.id ? " is-active" : ""}`}
          onClick={() => onTab(t.id)}
        >
          <span className="bottom-nav-icon" aria-hidden>
            {iconFor(t.id)}
          </span>
          <span className="bottom-nav-label">{t.label}</span>
          {t.soon ? <span className="bottom-nav-soon">Soon</span> : null}
        </button>
      ))}
    </nav>
  );
}

function iconFor(id: TabId): string {
  switch (id) {
    case "plots":
      return "▦";
    case "farmhands":
      return "◉";
    case "guide":
      return "ℹ";
    case "leaderboard":
      return "★";
    case "replant":
      return "↻";
    case "settings":
      return "⚙";
    default:
      return "·";
  }
}
