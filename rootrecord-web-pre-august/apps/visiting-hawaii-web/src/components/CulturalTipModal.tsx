import { useAppStore } from "../store/useAppStore";

export function CulturalTipModal() {
  const seen = useAppStore((s) => s.culturalTipSeen);
  const setSeen = useAppStore((s) => s.setCulturalTipSeen);

  if (seen) return null;

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal-sheet cultural-modal fade-in" role="dialog" aria-labelledby="cultural-title">
        <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }} aria-hidden>
          🌺
        </div>
        <h2 id="cultural-title">Travel pono</h2>
        <p>
          Hawaiʻi is not a backdrop — it is a living culture and homeland. Observe kapu (sacred restrictions),
          never take lava rocks or sand, give space to honu and monk seals, and support local businesses. When
          unsure, ask respectfully or choose another path.
        </p>
        <button type="button" className="btn btn--primary" onClick={() => setSeen(true)}>
          I understand — mālama ʻāina
        </button>
      </div>
    </div>
  );
}
