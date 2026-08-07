import { islandById, CATEGORIES } from "../data/catalog";
import { placesForIsland } from "../data/places";
import { getIslandWeather } from "../lib/weather";
import { useAppStore } from "../store/useAppStore";
import { PlaceCard } from "./PlaceCard";
import { SponsoredListingsStrip } from "./SponsoredListingsStrip";

export function HomeScreen() {
  const islandId = useAppStore((s) => s.selectedIslandId)!;
  const setTab = useAppStore((s) => s.setTab);
  const setExploreCategory = useAppStore((s) => s.setExploreCategory);
  const openPlace = useAppStore((s) => s.openPlace);
  const island = islandById(islandId)!;
  const weather = getIslandWeather(islandId);
  const places = placesForIsland(islandId).slice(0, 4);

  return (
    <div className="fade-in">
      <div className="hero-home" style={{ background: island.heroGradient }}>
        <h1>{island.name}</h1>
        <p>{island.nickname} · {island.tagline}</p>
      </div>

      <div className="weather-strip">
        <span aria-hidden>🌤️</span>
        <div>
          <strong>{weather.highF}°F</strong> / {weather.lowF}°F · {weather.summary}
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
            Wind {weather.wind} · Updated {weather.updated}
          </div>
        </div>
      </div>

      <h2 className="section-title">Explore by category</h2>
      <div className="category-grid" style={{ paddingBottom: "0.5rem" }}>
        {CATEGORIES.slice(0, 4).map((cat) => (
          <button
            key={cat.id}
            type="button"
            className="category-tile"
            onClick={() => {
              setExploreCategory(cat.id);
              setTab("explore");
            }}
          >
            <span className="category-tile__icon">{cat.icon}</span>
            <span className="category-tile__label">{cat.label}</span>
          </button>
        ))}
      </div>
      <div style={{ padding: "0 1rem 1rem", textAlign: "center" }}>
        <button type="button" className="btn btn--ghost" onClick={() => setTab("explore")}>
          View all categories
        </button>
      </div>

      <SponsoredListingsStrip islandId={islandId} />

      <h2 className="section-title">Featured on {island.name}</h2>
      <p className="section-lead">Hand-picked spots — full guide preloaded for offline use.</p>
      <div className="grid-places">
        {places.map((p) => (
          <PlaceCard key={p.id} place={p} onClick={() => openPlace(p.id)} />
        ))}
      </div>

      <p className="footer-credit">
        Built by <a href="https://rootrecord.info" target="_blank" rel="noopener noreferrer">RootRecord</a>
      </p>
    </div>
  );
}
