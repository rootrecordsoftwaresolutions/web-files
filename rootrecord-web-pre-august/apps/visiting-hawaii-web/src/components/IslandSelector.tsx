import { ISLANDS } from "../data/catalog";
import type { IslandId } from "../types";

interface Props {
  onSelect: (id: IslandId) => void;
}

export function IslandSelector({ onSelect }: Props) {
  return (
    <div className="fade-in">
      <h2 className="section-title">Choose your island</h2>
      <p className="section-lead">
        All guide content preloads for offline use once selected. Switch anytime from the header.
      </p>
      <div className="island-scroll">
        {ISLANDS.map((island) => (
          <button
            key={island.id}
            type="button"
            className="island-card"
            onClick={() => onSelect(island.id)}
          >
            <div className="island-card__hero" style={{ background: island.heroGradient }}>
              <h3 className="island-card__name">{island.name}</h3>
              <p className="island-card__nick">{island.nickname}</p>
            </div>
            <div className="island-card__body">
              <p className="island-card__vibe">{island.vibe}</p>
              <p style={{ margin: "0.35rem 0 0", fontSize: "0.82rem" }}>{island.tagline}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
