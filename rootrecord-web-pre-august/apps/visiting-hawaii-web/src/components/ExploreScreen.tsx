import { CATEGORIES, categoryById } from "../data/catalog";
import { placesForIsland } from "../data/places";
import { filterPlaces } from "../lib/utils";
import { useAppStore } from "../store/useAppStore";
import { EmptyState } from "./EmptyState";
import { PlaceCard } from "./PlaceCard";
import { SearchBar } from "./SearchBar";
import { SponsoredListingsStrip } from "./SponsoredListingsStrip";

export function ExploreScreen() {
  const islandId = useAppStore((s) => s.selectedIslandId)!;
  const category = useAppStore((s) => s.exploreCategory);
  const subFilter = useAppStore((s) => s.exploreSubFilter);
  const setExploreCategory = useAppStore((s) => s.setExploreCategory);
  const searchQuery = useAppStore((s) => s.searchQuery);
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);
  const openPlace = useAppStore((s) => s.openPlace);

  const catMeta = category ? categoryById(category) : null;
  const all = placesForIsland(islandId);
  const filtered = filterPlaces(all, { query: searchQuery, category, subFilter });

  return (
    <div className="fade-in">
      <SearchBar value={searchQuery} onChange={setSearchQuery} />

      <h2 className="section-title">Categories</h2>
      <div className="category-grid">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            className={`category-tile${category === cat.id ? " category-tile--active" : ""}`}
            onClick={() => setExploreCategory(category === cat.id ? null : cat.id)}
          >
            <span className="category-tile__icon">{cat.icon}</span>
            <span className="category-tile__label">{cat.label}</span>
          </button>
        ))}
      </div>

      {catMeta && (
        <>
          <p className="section-lead">{catMeta.description}</p>
          <div className="subfilter-row">
            <button
              type="button"
              className={`subfilter-chip${!subFilter ? " subfilter-chip--active" : ""}`}
              onClick={() => setExploreCategory(catMeta.id, null)}
            >
              All
            </button>
            {catMeta.subFilters.map((sf) => (
              <button
                key={sf}
                type="button"
                className={`subfilter-chip${subFilter === sf ? " subfilter-chip--active" : ""}`}
                onClick={() => setExploreCategory(catMeta.id, sf)}
              >
                {sf.replace(/-/g, " ")}
              </button>
            ))}
          </div>
        </>
      )}

      <SponsoredListingsStrip islandId={islandId} categoryId={category} title="Sponsored local partners" />

      <h2 className="section-title">
        {filtered.length} place{filtered.length === 1 ? "" : "s"}
      </h2>

      {filtered.length === 0 ? (
        <EmptyState
          title="No matches"
          message="Try another category or clear your search — we're always adding local gems."
          action={
            <button type="button" className="btn btn--ghost" onClick={() => { setSearchQuery(""); setExploreCategory(null); }}>
              Reset filters
            </button>
          }
        />
      ) : (
        <div className="grid-places">
          {filtered.map((p) => (
            <PlaceCard key={p.id} place={p} onClick={() => openPlace(p.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
