import { formatGrowTime, formatRu } from "../game/format";
import type { FarmsPurchaseKind, OrchardAppBonusTree } from "../lib/farmsApi";
import type { TierPlotProgress } from "../game/tier-catalog";
import { AccountBalanceHud } from "./AccountBalanceHud";

type Props = {
  title: string;
  lead: string;
  plots: TierPlotProgress[];
  locked: boolean;
  lockedMessage: string;
  unlockKind: FarmsPurchaseKind;
  rowKind: FarmsPurchaseKind;
  nameFor: (id: number) => string;
  descriptionFor?: (id: number) => string;
  growSecFor: (id: number) => number;
  harvestFor?: (plot: TierPlotProgress) => number;
  unlockCostFor: (id: number) => number;
  rowCostFor: (id: number, rows: number) => number;
  onPurchase: (kind: FarmsPurchaseKind, id: number) => void;
  purchaseBusy: boolean;
  orchardAppBonus?: OrchardAppBonusTree[];
};

export function TierPlotsScreen({
  title,
  lead,
  plots,
  locked,
  lockedMessage,
  unlockKind,
  rowKind,
  nameFor,
  descriptionFor,
  growSecFor,
  harvestFor,
  unlockCostFor,
  rowCostFor,
  onPurchase,
  purchaseBusy,
  orchardAppBonus,
}: Props) {
  const bonusById = new Map((orchardAppBonus ?? []).map((b) => [b.id, b]));

  if (locked) {
    return (
      <div className="screen">
        <AccountBalanceHud />
        <header className="screen-header">
          <h1>{title}</h1>
          <p className="screen-lead">{lockedMessage}</p>
        </header>
        <div className="tier-locked-card">
          <span className="tier-locked-emoji" aria-hidden>
            🌱
          </span>
          <div>
            <p className="tier-locked-title">Tier sealed</p>
            <p className="tier-locked-sub">{lockedMessage}</p>
          </div>
        </div>
      </div>
    );
  }

  const unlockedCount = plots.filter((p) => p.unlocked).length;
  const totalRows = plots.reduce((n, p) => n + (p.unlocked ? p.rowCount : 0), 0);
  const totalActiveRows = plots.reduce((n, p) => n + (p.unlocked ? p.rowsActive : 0), 0);

  return (
    <div className="screen">
      <AccountBalanceHud />
      <header className="screen-header">
        <h1>{title}</h1>
        <p className="screen-lead">{lead}</p>
      </header>
      <div className="tier-stat-strip" aria-label="Tier totals">
        <div className="tier-stat-pill">
          <span className="tier-stat-k">Plots</span>
          <span className="tier-stat-v">
            {unlockedCount}<small>/{plots.length}</small>
          </span>
        </div>
        <div className="tier-stat-pill">
          <span className="tier-stat-k">Rows</span>
          <span className="tier-stat-v">{totalRows}</span>
        </div>
        <div className="tier-stat-pill">
          <span className="tier-stat-k">Growing</span>
          <span className="tier-stat-v">{totalActiveRows}</span>
        </div>
      </div>
      <div className="section-head tier-section-head">
        <span>{title} ({plots.length})</span>
        <span>Tap for rows &amp; grow info</span>
      </div>
      <div className="plots-grid tier-plots-grid">
        {plots.map((p) => {
          const grow = growSecFor(p.id);
          const harvest = harvestFor?.(p) ?? 0;
          const unlockCost = unlockCostFor(p.id);
          const rowCost = p.unlocked ? rowCostFor(p.id, p.rowCount) : 0;
          const appBonus = bonusById.get(p.id);
          const cycle = Math.min(1, Math.max(0, p.cycleProgress));
          return (
            <article
              key={p.id}
              className={`plot-card plot-card--grid accent-green${p.unlocked ? "" : " tier-plot-card-locked"}`}
              style={p.unlocked ? ({ ["--grow" as any]: cycle } as React.CSSProperties) : undefined}
            >
              {p.unlocked ? (
                <span
                  className="plot-plant"
                  aria-hidden
                  data-stage={cycle >= 0.95 ? "ripe" : cycle >= 0.5 ? "mid" : "sprout"}
                >
                  <span className="plot-plant-leaf plot-plant-leaf--l" />
                  <span className="plot-plant-leaf plot-plant-leaf--r" />
                  <span className="plot-plant-leaf plot-plant-leaf--c" />
                  <span className="plot-plant-stem" />
                  <span className="plot-plant-soil" />
                </span>
              ) : null}
              <div className="plot-card-top">
                <div className="plot-card-main">
                  <span className="plot-name">
                    {p.unlocked ? null : (
                      <span className="plot-name-lock" aria-hidden>🔒</span>
                    )}
                    {nameFor(p.id)}
                    {p.unlocked ? <span className="plot-dot" aria-label="active" /> : null}
                  </span>
                  {descriptionFor ? <span className="plot-sub plot-sub--sci">{descriptionFor(p.id)}</span> : null}
                  <span className="plot-sub">
                    {p.unlocked
                      ? `${p.rowCount}/10 rows · ${p.rowsActive} growing`
                      : `Unlock · ${formatRu(unlockCost)}`}
                  </span>
                  {p.unlocked ? <span className="plot-sub">{formatGrowTime(grow)} / harvest</span> : null}
                </div>
                <span className="plot-yield">
                  {p.unlocked ? formatRu(harvest) : formatRu(unlockCost)}
                  <small>{p.unlocked ? "/ harvest" : "unlock"}</small>
                </span>
              </div>
              {appBonus ? (
                <p className={`plot-bonus${appBonus.active ? "" : " is-muted"}`}>
                  {appBonus.active
                    ? "+10% total earnings active"
                    : appBonus.used_recently
                      ? "Unlock tree to use recent app bonus"
                      : "Open the matching app to activate +10%"}
                </p>
              ) : null}
              {p.unlocked ? (
                <>
                  <div className="seg-bar tier-seg-bar" aria-hidden>
                    {Array.from({ length: 10 }, (_, i) => (
                      <span key={i} className={i < p.rowCount ? "on" : ""} />
                    ))}
                  </div>
                  <div className="plot-cycle" style={{ width: `${Math.min(100, p.cycleProgress * 100)}%` }} />
                </>
              ) : null}
              <div className="plot-card-actions tier-card-actions">
                {p.unlocked ? (
                  <button
                    type="button"
                    className="btn btn-buy btn-sm tier-row-action"
                    disabled={purchaseBusy || p.rowCount >= 10}
                    onClick={() => onPurchase(rowKind, p.id)}
                  >
                    Add row ({formatRu(rowCost)})
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={purchaseBusy}
                    onClick={() => onPurchase(unlockKind, p.id)}
                  >
                    Unlock
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
