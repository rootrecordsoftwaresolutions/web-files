import type { TabId } from "../game/types";

const TABS: { id: TabId; label: string; short?: string; soon?: boolean }[] = [
  { id: "plots", label: "Plots" },
  { id: "roots", label: "Roots" },
  { id: "orchards", label: "Orchards", short: "Trees" },
  { id: "vegetables", label: "Vegetables", short: "Veg" },
  { id: "farmhands", label: "Farmhands", short: "Hands" },
  { id: "market", label: "The Well", short: "Well" },
  { id: "transactions", label: "Transactions", short: "Tx" },
  { id: "guide", label: "Guide" },
  { id: "leaderboard", label: "Root Economy", short: "Econ" },
  { id: "replant", label: "Replant", soon: true },
  { id: "settings", label: "Settings", short: "Settings" },
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
          <span className="bottom-nav-label">{t.short ?? t.label}</span>
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
    case "roots":
      return "⌑";
    case "orchards":
      return "🌳";
    case "vegetables":
      return "🥬";
    case "farmhands":
      return "◉";
    case "market":
      return "◇";
    case "transactions":
      return "↔";
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
