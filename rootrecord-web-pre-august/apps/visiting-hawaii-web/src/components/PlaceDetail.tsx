import { MalamaBar } from "./PlaceCard";
import type { Place } from "../types";
import { costLabel } from "../lib/utils";
import { useAppStore } from "../store/useAppStore";

interface Props {
  place: Place;
  onClose: () => void;
}

export function PlaceDetail({ place, onClose }: Props) {
  const isFavorite = useAppStore((s) => s.isFavorite(place.id));
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const userNote = useAppStore((s) => s.userNotes[place.id] ?? "");
  const setUserNote = useAppStore((s) => s.setUserNote);

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal-sheet fade-in" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="place-title">
        <div className="modal-sheet__hero">
          <button type="button" className="modal-sheet__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="modal-sheet__body">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <h2 id="place-title">{place.title}</h2>
            <button type="button" className="fav-btn" onClick={() => toggleFavorite(place.id)} aria-label="Toggle favorite">
              {isFavorite ? "❤️" : "🤍"}
            </button>
          </div>
          <p style={{ margin: 0, color: "var(--text-muted)", lineHeight: 1.55 }}>{place.description}</p>

          <div className="modal-sheet__section">
            <h3>Mālama rating</h3>
            <MalamaBar rating={place.malamaRating} />
          </div>

          {(place.duration || place.bestTime || place.costRange) && (
            <div className="modal-sheet__section">
              <h3>Quick facts</h3>
              <ul>
                {place.duration && <li>Duration: {place.duration}</li>}
                {place.bestTime && <li>Best time: {place.bestTime}</li>}
                <li>Cost: {costLabel(place.costRange)}</li>
                {place.difficulty && <li>Difficulty: {place.difficulty}</li>}
              </ul>
            </div>
          )}

          {(place.localTips ?? []).length > 0 && (
            <div className="modal-sheet__section">
              <h3>Local tips</h3>
              <ul>
                {(place.localTips ?? []).map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          )}

          {place.culturalNotes && (
            <div className="modal-sheet__section">
              <h3>Cultural notes</h3>
              <p style={{ margin: 0, lineHeight: 1.55, fontSize: "0.9rem" }}>{place.culturalNotes}</p>
            </div>
          )}

          {place.localVoice && (
            <div className="modal-sheet__section">
              <h3>Local voice</h3>
              <p className="local-voice">{place.localVoice}</p>
            </div>
          )}

          {place.safetyNotes && (
            <div className="modal-sheet__section">
              <h3>Safety</h3>
              <p style={{ margin: 0, color: "var(--sunset)", lineHeight: 1.55, fontSize: "0.9rem" }}>{place.safetyNotes}</p>
            </div>
          )}

          <div className="modal-sheet__section">
            <h3>My experience</h3>
            <textarea
              className="note-field"
              placeholder="Add your notes (saved on device)…"
              value={userNote}
              onChange={(e) => setUserNote(place.id, e.target.value)}
            />
          </div>

          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "1rem" }}>
            GPS: {place.lat.toFixed(4)}, {place.lng.toFixed(4)}
          </p>
        </div>
      </div>
    </div>
  );
}
