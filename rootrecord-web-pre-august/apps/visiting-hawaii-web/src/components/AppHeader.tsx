import { IslandSwitcher } from "./IslandSwitcher";

export function AppHeader() {
  return (
    <header className="app-header">
      <div className="app-header__brand">
        Visiting <span>Hawaiʻi</span>
      </div>
      <IslandSwitcher />
    </header>
  );
}
