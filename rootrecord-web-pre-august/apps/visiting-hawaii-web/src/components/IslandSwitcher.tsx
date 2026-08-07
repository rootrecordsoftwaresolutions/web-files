import { ISLANDS } from "../data/catalog";
import { useAppStore } from "../store/useAppStore";
import type { IslandId } from "../types";

export function IslandSwitcher() {
  const selectedIslandId = useAppStore((s) => s.selectedIslandId);
  const setIsland = useAppStore((s) => s.setIsland);
  const island = ISLANDS.find((i) => i.id === selectedIslandId);

  if (!island) return null;

  return (
    <select
      className="island-switcher"
      value={island.id}
      onChange={(e) => setIsland(e.target.value as IslandId)}
      aria-label="Switch island"
    >
      {ISLANDS.map((i) => (
        <option key={i.id} value={i.id}>
          {i.name}
        </option>
      ))}
    </select>
  );
}
