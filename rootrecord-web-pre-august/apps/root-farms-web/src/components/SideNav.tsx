import type { TabId } from "../game/types";

const TABS: { id: TabId; label: string; soon?: boolean }[] = [
  { id: "plots", label: "Plots" },
  { id: "roots", label: "Roots" },
  { id: "orchards", label: "Orchards" },
  { id: "vegetables", label: "Vegetables" },
  { id: "farmhands", label: "Farmhands" },
  { id: "market", label: "The Well" },
  { id: "transactions", label: "Transactions" },
  { id: "guide", label: "Guide" },
  { id: "leaderboard", label: "Root Economy" },
  { id: "replant", label: "Replant", soon: true },
  { id: "settings", label: "Settings" },
];

export function SideNav({ tab, onTab }: { tab: TabId; onTab: (t: TabId) => void }) {
  return (
    <nav className="side-nav" aria-label="Main">
      <div className="side-nav-brand">
        <span className="side-nav-logo" aria-hidden>
          ▦
        </span>
        <div>
          <p className="side-nav-title">Root Farms</p>
          <p className="side-nav-tag">Web</p>
        </div>
      </div>
      <ul className="side-nav-list">
        {TABS.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              className={`side-nav-btn${tab === t.id ? " is-active" : ""}`}
              onClick={() => onTab(t.id)}
            >
              <span className="side-nav-icon" aria-hidden>
                {iconFor(t.id)}
              </span>
              <span>{t.label}</span>
              {t.soon ? <span className="side-nav-soon">Soon</span> : null}
            </button>
          </li>
        ))}
      </ul>
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
