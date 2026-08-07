import { formatRu, formatRuRate } from "../game/format";
import { totalRuPerHarvest, totalRuPerSec } from "../game/sim";
import { vegetableHarvestTotal, vegetableIncomePerSec } from "../game/tier-income";
import { protectionIncomeMultiplier, rootClusterIncomeMultiplier } from "../game/storeCatalog";
import type { FarmsStoreData } from "../game/storeCatalog";
import type { GameSave } from "../game/types";
import type { TierPlotProgress } from "../game/tier-catalog";

type Card = {
  key: string;
  title: string;
  icon: string;
  plotsLabel: string;
  harvest: number;
  perSec: number;
  bonusLabel?: string;
  locked?: boolean;
  lockedHint?: string;
};

export function PlotTierSummary({
  save,
  store,
  orchardAppBonusMultiplier = 1,
  orchardActiveBonusCount = 0,
  vegetables,
  vegetablesUnlocked,
  onOpenTier,
}: {
  save: GameSave;
  store: FarmsStoreData;
  orchardAppBonusMultiplier?: number;
  orchardActiveBonusCount?: number;
  vegetables: TierPlotProgress[];
  vegetablesUnlocked: boolean;
  onOpenTier?: (tier: "roots" | "orchards" | "vegetables") => void;
}) {
  const mult = protectionIncomeMultiplier(store) * rootClusterIncomeMultiplier(store) * Math.max(1, orchardAppBonusMultiplier);
  const rootsUnlocked = save.plots.filter((p) => p.unlocked).length;
  const rootsRows = save.plots.reduce((n, p) => n + (p.unlocked ? p.rowCount : 0), 0);
  const clusterTreeCount = Array.isArray(store.root_clusters) ? store.root_clusters.filter(Boolean).length : 0;
  const orchardBonusPct = Math.round((Math.max(1, orchardAppBonusMultiplier) - 1) * 100) + clusterTreeCount * 5;
  const orchardBonusLabel =
    orchardActiveBonusCount > 0 || clusterTreeCount > 0
      ? ` · ${orchardActiveBonusCount} app active · ${clusterTreeCount} cluster tree${clusterTreeCount === 1 ? "" : "s"}`
      : "";

  const cards: Card[] = [
    {
      key: "roots",
      title: "Roots",
      icon: "🥕",
      plotsLabel: `${rootsUnlocked} plots · ${rootsRows} rows`,
      harvest: totalRuPerHarvest(save),
      perSec: totalRuPerSec(save, mult),
    },
    {
      key: "orchards",
      title: "Orchards",
      icon: "🌳",
      plotsLabel: `3 app trees${orchardBonusLabel}`,
      harvest: 0,
      perSec: 0,
      bonusLabel: `+${orchardBonusPct}% bonus income`,
    },
    {
      key: "vegetables",
      title: "Vegetables",
      icon: "🥬",
      plotsLabel: vegetablesUnlocked
        ? `${vegetables.filter((v) => v.unlocked).length} plots · ${vegetables.reduce((n, v) => n + (v.unlocked ? v.rowCount : 0), 0)} rows`
        : "Locked",
      harvest: vegetableHarvestTotal(vegetables),
      perSec: vegetableIncomePerSec(vegetables, mult),
      locked: !vegetablesUnlocked,
      lockedHint: "Farm level 20",
    },
  ];

  return (
    <div className="plot-tier-summary" aria-label="Earnings by plot type">
      {cards.map((c) => (
        <article
          key={c.key}
          className={`plot-tier-card${c.locked ? " plot-tier-card--locked" : ""}`}
        >
          <div className="plot-tier-card-head">
            <span className="plot-tier-icon" aria-hidden>
              {c.icon}
            </span>
            <div>
              <h2 className="plot-tier-title">{c.title}</h2>
              <p className="plot-tier-meta">{c.plotsLabel}</p>
            </div>
          </div>
          {c.locked ? (
            <p className="plot-tier-locked">{c.lockedHint}</p>
          ) : c.bonusLabel ? (
            <p className="plot-tier-yield">
              <strong>{c.bonusLabel}</strong>
            </p>
          ) : (
            <p className="plot-tier-yield">
              <strong>{formatRu(c.harvest)}</strong>
              <span> / harvest · {formatRuRate(c.perSec)}</span>
            </p>
          )}
          {onOpenTier && c.key === "roots" ? (
            <button type="button" className="btn btn-ghost btn-sm plot-tier-link" onClick={() => onOpenTier("roots")}>
              Manage root plots
            </button>
          ) : null}
          {onOpenTier && c.key === "orchards" ? (
            <button type="button" className="btn btn-ghost btn-sm plot-tier-link" onClick={() => onOpenTier("orchards")}>
              Manage orchards
            </button>
          ) : null}
          {onOpenTier && c.key === "vegetables" && vegetablesUnlocked ? (
            <button type="button" className="btn btn-ghost btn-sm plot-tier-link" onClick={() => onOpenTier("vegetables")}>
              Manage vegetables
            </button>
          ) : null}
        </article>
      ))}
    </div>
  );
}
