import { useGame } from "../contexts/GameContext";
import { isAdvisoryEvent, isAttackEvent, isBlockEvent } from "../game/storeCatalog";

export function VarmintAlertModal() {
  const { activeVarmintEvent, dismissActiveVarmint } = useGame();
  if (!activeVarmintEvent) return null;

  const advisory = isAdvisoryEvent(activeVarmintEvent.kind);
  const attack = isAttackEvent(activeVarmintEvent.kind);
  const blocked = isBlockEvent(activeVarmintEvent.kind);

  let title = "Farm alert";
  if (advisory) title = "Farm notice";
  else if (attack) title = "Varmint attack";
  else if (blocked) title = "Protection worked";

  return (
    <div className="varmint-overlay" role="dialog" aria-modal="true" aria-labelledby="varmint-alert-title">
      <div
        className={`varmint-card${attack ? " varmint-card--attack" : ""}${blocked ? " varmint-card--block" : ""}${advisory ? " varmint-card--advisory" : ""}`}
      >
        <h2 id="varmint-alert-title" className="varmint-card-title">
          {title}
        </h2>
        <p className="varmint-card-msg">{activeVarmintEvent.message}</p>
        {advisory ? (
          <p className="varmint-card-hint">Open <strong>Farmhands</strong> to add protection or storm gear.</p>
        ) : null}
        <button type="button" className="btn btn-primary btn-block" onClick={() => void dismissActiveVarmint()}>
          OK
        </button>
      </div>
    </div>
  );
}
