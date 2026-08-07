import type { Place } from "../types";
import { costLabel, malamaLabel } from "../lib/utils"; // malamaLabel used in MalamaBar
import { useAppStore } from "../store/useAppStore";

interface Props {
  place: Place;
  onClick: () => void;
}

export function PlaceCard({ place, onClick }: Props) {
  const isFavorite = useAppStore((s) => s.isFavorite(place.id));
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);

  return (
    <article className="place-card" onClick={onClick} onKeyDown={(e) => e.key === "Enter" && onClick()} role="button" tabIndex={0}>
      <div className="place-card__thumb" />
      <div className="place-card__body">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
          <h3 className="place-card__title">{place.title}</h3>
          <button
            type="button"
            className="fav-btn"
            aria-label={isFavorite ? "Remove from saved" : "Save place"}
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(place.id);
            }}
          >
            {isFavorite ? "❤️" : "🤍"}
          </button>
        </div>
        <p className="place-card__desc">{place.shortDescription}</p>
        <div className="place-card__meta">
          <span className="chip">{costLabel(place.costRange)}</span>
          {place.difficulty && <span className="chip chip--sunset">{place.difficulty}</span>}
          <span className="chip">Mālama {place.malamaRating}/5</span>
        </div>
      </div>
    </article>
  );
}

export function MalamaBar({ rating }: { rating: number }) {
  return (
    <div className="malama-bar">
      <div className="malama-dots" aria-hidden>
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className={`malama-dot${n <= rating ? " malama-dot--on" : ""}`} />
        ))}
      </div>
      <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{malamaLabel(rating)}</span>
    </div>
  );
}
