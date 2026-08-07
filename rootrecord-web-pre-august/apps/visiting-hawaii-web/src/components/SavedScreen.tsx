import { placeById } from "../data/places";
import { useAppStore } from "../store/useAppStore";
import { EmptyState } from "./EmptyState";
import { PlaceCard } from "./PlaceCard";

const TRIP_TEMPLATES = [
  { name: "1-Day Highlights", template: "1-day" as const },
  { name: "3-Day Explorer", template: "3-day" as const },
  { name: "Family Friendly", template: "family" as const },
  { name: "Adventure Week", template: "adventure" as const },
];

export function SavedScreen() {
  const favorites = useAppStore((s) => s.favorites);
  const savedTrips = useAppStore((s) => s.savedTrips);
  const islandId = useAppStore((s) => s.selectedIslandId)!;
  const addSavedTrip = useAppStore((s) => s.addSavedTrip);
  const removeSavedTrip = useAppStore((s) => s.removeSavedTrip);
  const openPlace = useAppStore((s) => s.openPlace);

  const favPlaces = favorites.map((id) => placeById(id)).filter(Boolean);

  const createFromTemplate = (name: string, template: typeof TRIP_TEMPLATES[number]["template"]) => {
    addSavedTrip({
      name,
      islandId,
      placeIds: favorites.slice(0, 5),
      template,
    });
  };

  return (
    <div className="fade-in">
      <h2 className="section-title">Saved places</h2>
      <p className="section-lead">Tap ❤️ on any guide to save it here — stored on your device.</p>

      {favPlaces.length === 0 ? (
        <EmptyState icon="🤍" title="No saved places yet" message="Explore categories and save spots for your itinerary." />
      ) : (
        <div className="grid-places">
          {favPlaces.map((p) => p && <PlaceCard key={p.id} place={p} onClick={() => openPlace(p.id)} />)}
        </div>
      )}

      <h2 className="section-title" style={{ marginTop: "1.5rem" }}>
        Trip collections
      </h2>
      <p className="section-lead">Quick-start itineraries from your current favorites.</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", padding: "0 1rem 1rem" }}>
        {TRIP_TEMPLATES.map((t) => (
          <button
            key={t.template}
            type="button"
            className="btn btn--ghost"
            disabled={favorites.length === 0}
            onClick={() => createFromTemplate(`${t.name} — ${islandId}`, t.template)}
          >
            + {t.name}
          </button>
        ))}
      </div>

      {savedTrips.length === 0 ? (
        <EmptyState icon="📋" title="No custom trips" message="Create a collection above once you've saved a few places." />
      ) : (
        savedTrips.map((trip) => (
          <div key={trip.id} className="trip-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h3>{trip.name}</h3>
                <p>
                  {trip.placeIds.length} stops · {trip.template ?? "custom"} · {new Date(trip.createdAt).toLocaleDateString()}
                </p>
              </div>
              <button type="button" className="btn btn--ghost" style={{ padding: "0.35rem 0.65rem", fontSize: "0.75rem" }} onClick={() => removeSavedTrip(trip.id)}>
                Remove
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
