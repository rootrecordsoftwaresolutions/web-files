import {
  PLOT_COUNT,
  ROOT_CLUSTER_COUNT,
  getPlotCatalog,
  plotRuPerCycle,
  plotUnlockCost,
  rootClusterCost,
  rootClusterName,
  rootClusterRange,
} from "../game/catalog";
import { formatRu, formatRuRate } from "../game/format";
import { canBuyPlotUnlock, farmsProgressStats, totalRuPerHarvest, totalRuPerSec } from "../game/sim";
import { vegetableHarvestTotal, vegetableIncomePerSec } from "../game/tier-income";
import { protectionIncomeMultiplier, rootClusterIncomeMultiplier } from "../game/storeCatalog";
import type { GameSave, PlotProgress, TabId } from "../game/types";
import { useGame, type PurchaseResult } from "../contexts/GameContext";
import { AccountBalanceHud } from "./AccountBalanceHud";
import { PlotTierSummary } from "./PlotTierSummary";

type Props = {
  onOpenPlot: (plotId: number) => void;
  onOpenTier?: (tab: TabId) => void;
  variant?: "web" | "mobile";
  showSummary?: boolean;
  showRootGrid?: boolean;
};

export function PlotsGridScreen({
  onOpenPlot,
  onOpenTier,
  variant = "web",
  showSummary = true,
  showRootGrid = true,
}: Props) {
  const {
    save,
    syncNote,
    purchasePlotUnlock,
    purchaseRootCluster,
    handleInsufficientFunds,
    purchaseBusy,
    balanceReady,
    ruPerSec,
    store,
    orchardAppBonus,
    vegetables,
    vegetablesUnlocked,
  } = useGame();
  const { plotsUnlocked, rowsAccumulated } = farmsProgressStats(save);
  const rootsHarvestTotal = totalRuPerHarvest(save);
  const rootsBaseRate = totalRuPerSec(save, 1);
  const vegetablesUnlockedCount = vegetables.filter((v) => v.unlocked).length;
  const vegetablesRows = vegetables.reduce((n, v) => n + (v.unlocked ? v.rowCount : 0), 0);
  const vegetableHarvest = vegetablesUnlocked ? vegetableHarvestTotal(vegetables) : 0;
  const vegetableBaseRate = vegetablesUnlocked ? vegetableIncomePerSec(vegetables, 1) : 0;
  const protectionMult = protectionIncomeMultiplier(store);
  const clusterTreeCount = Array.isArray(store.root_clusters) ? store.root_clusters.filter(Boolean).length : 0;
  const clusterMult = rootClusterIncomeMultiplier(store);
  const clusterBonusPct = Math.round((clusterMult - 1) * 100);
  const appActiveCount = orchardAppBonus?.active_count ?? 0;
  const appMult = Math.max(1, orchardAppBonus?.multiplier ?? 1);
  const appBonusPct = Math.round((appMult - 1) * 100);
  const beforeFarmhandsRate = (rootsBaseRate + vegetableBaseRate) * clusterMult * appMult;

  return (
    <div className={`screen plots-screen plots-screen--${variant}`}>
      <AccountBalanceHud
        variant={variant}
        side={
          <>
            <p className="hud-rate">
              +{formatRuRate(ruPerSec)} <span className="hud-rate-note">all sources</span>
            </p>
            {beforeFarmhandsRate > ruPerSec + 0.05 ? (
              <p className="hud-meta hud-meta--dim">Before farmhands: {formatRuRate(beforeFarmhandsRate)}</p>
            ) : null}
            <div className="hud-income-breakdown" aria-label="Income sources">
              <p className="hud-meta">
                Roots: {plotsUnlocked} plots · {rowsAccumulated} rows · {formatRu(rootsHarvestTotal)} / harvest · {formatRuRate(rootsBaseRate * protectionMult)}
              </p>
              {vegetablesUnlocked ? (
                <p className="hud-meta">
                  Veg: {vegetablesUnlockedCount} plots · {vegetablesRows} rows · {formatRu(vegetableHarvest)} / harvest · {formatRuRate(vegetableBaseRate * protectionMult)}
                </p>
              ) : (
                <p className="hud-meta">Veg: locked until farm level 20</p>
              )}
              <p className="hud-meta">
                Trees: {clusterTreeCount} cluster · +{clusterBonusPct}% · Apps: {appActiveCount} active · +{appBonusPct}%
              </p>
            </div>
            {syncNote ? <p className="hud-sync">{syncNote}</p> : null}
          </>
        }
      />

      {showSummary ? (
        <PlotTierSummary
          save={save}
          store={store}
          orchardAppBonusMultiplier={orchardAppBonus?.multiplier ?? 1}
          orchardActiveBonusCount={orchardAppBonus?.active_count ?? 0}
          vegetables={vegetables}
          vegetablesUnlocked={vegetablesUnlocked}
          onOpenTier={
            onOpenTier
              ? (tier) => onOpenTier(tier)
              : undefined
          }
        />
      ) : null}

      {showRootGrid ? (
        <>
          <div className="section-head">
            <span>Root plots ({PLOT_COUNT})</span>
            <span>Tap for rows &amp; grow info</span>
          </div>

          <div className="plots-grid">
            {Array.from({ length: ROOT_CLUSTER_COUNT }, (_, i) => {
              const clusterId = i + 1;
              const range = rootClusterRange(clusterId);
              const plots = save.plots.filter((plot) => plot.id >= range.start && plot.id <= range.end);
              const completed = plots.every((plot) => plot.unlocked && plot.rowCount >= getPlotCatalog(plot.id).maxRows);
              const clustered = store.root_clusters?.[clusterId - 1] === true;
              if (clustered) return null;
              const plotCards = plots.map((plot) =>
                plot.unlocked ? (
                  <PlotGridCard key={plot.id} plot={plot} onOpen={() => onOpenPlot(plot.id)} />
                ) : (
                  <LockedPlotGridCard
                    key={plot.id}
                    save={save}
                    plotId={plot.id}
                    balanceReady={balanceReady}
                    purchaseBusy={purchaseBusy}
                    onUnlock={purchasePlotUnlock}
                    onInsufficientFunds={handleInsufficientFunds}
                    onLearn={() => onOpenPlot(plot.id)}
                  />
                ),
              );
              if (!completed) return plotCards;
              return [
                <RootClusterCard
                  key={`cluster-${clusterId}`}
                  clusterId={clusterId}
                  completed={completed}
                  clustered={clustered}
                  balanceReady={balanceReady}
                  purchaseBusy={purchaseBusy}
                  onCluster={purchaseRootCluster}
                  onInsufficientFunds={handleInsufficientFunds}
                />,
                ...plotCards,
              ];
            })}
            {save.plots.slice(ROOT_CLUSTER_COUNT * 10).map((plot) =>
              plot.unlocked ? (
                <PlotGridCard key={plot.id} plot={plot} onOpen={() => onOpenPlot(plot.id)} />
              ) : (
                <LockedPlotGridCard
                  key={plot.id}
                  save={save}
                  plotId={plot.id}
                  balanceReady={balanceReady}
                  purchaseBusy={purchaseBusy}
                  onUnlock={purchasePlotUnlock}
                  onInsufficientFunds={handleInsufficientFunds}
                  onLearn={() => onOpenPlot(plot.id)}
                />
              ),
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

function RootClusterCard({
  clusterId,
  completed,
  clustered,
  balanceReady,
  purchaseBusy,
  onCluster,
  onInsufficientFunds,
}: {
  clusterId: number;
  completed: boolean;
  clustered: boolean;
  balanceReady: boolean;
  purchaseBusy: boolean;
  onCluster: (clusterId: number) => Promise<PurchaseResult>;
  onInsufficientFunds: () => Promise<void>;
}) {
  const range = rootClusterRange(clusterId);
  const cost = rootClusterCost(clusterId);

  const handleCluster = async () => {
    const r = await onCluster(clusterId);
    if (r === "insufficient") await onInsufficientFunds();
    else if (r === "offline") window.alert("Could not reach the server. Try again after reconnecting.");
    else if (r === "unavailable") window.alert("Cluster is not available yet.");
  };

  return (
    <article className="plot-card plot-card--grid plot-card--cluster accent-green">
      <div className="plot-card-top">
        <div className="plot-card-main">
          <span className="plot-name">
            {rootClusterName(clusterId)}
            {clustered ? <span className="plot-dot" aria-label="clustered" /> : null}
          </span>
          <span className="plot-sub plot-sub--sci">
            Root plots {range.start}-{range.end}
          </span>
          <span className="plot-sub">
            {clustered ? "Clustered tree · +5% total income" : "Completed stage ready to cluster"}
          </span>
        </div>
        <span className="plot-yield">
          +5%
          <small>income</small>
        </span>
      </div>
      {!clustered ? (
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={!completed || !balanceReady || purchaseBusy}
          onClick={() => void handleCluster()}
        >
          Cluster ({formatRu(cost)})
        </button>
      ) : null}
    </article>
  );
}

function PlotGridCard({ plot, onOpen }: { plot: PlotProgress; onOpen: () => void }) {
  const cat = getPlotCatalog(plot.id);
  const perHarvest = plotRuPerCycle(cat, plot.rowsActive, plot.rowCount);
  const grow = Math.min(1, Math.max(0, plot.cycleProgress));

  return (
    <button
      type="button"
      className={`plot-card plot-card--grid accent-${cat.accent}`}
      onClick={onOpen}
      data-plot-id={plot.id}
      style={{ ["--grow" as any]: grow }}
    >
      <span className="plot-plant" aria-hidden data-stage={grow >= 0.95 ? "ripe" : grow >= 0.5 ? "mid" : "sprout"}>
        <span className="plot-plant-leaf plot-plant-leaf--l" />
        <span className="plot-plant-leaf plot-plant-leaf--r" />
        <span className="plot-plant-leaf plot-plant-leaf--c" />
        <span className="plot-plant-stem" />
        <span className="plot-plant-soil" />
      </span>
      <div className="plot-card-top">
        <div className="plot-card-main">
          <span className="plot-name">
            {cat.name}
            <span className="plot-dot" aria-label="active" />
          </span>
          <span className="plot-sub plot-sub--sci">{cat.scientificName}</span>
          <span className="plot-sub">
            {plot.rowCount}/{cat.maxRows} rows · {plot.rowsActive} growing
          </span>
        </div>
        <span className="plot-yield">
          {formatRu(perHarvest)}
          <small>/ harvest</small>
        </span>
      </div>
      <div className="seg-bar" aria-hidden>
        {Array.from({ length: cat.maxRows }, (_, i) => (
          <span key={i} className={i < plot.rowCount ? "on" : ""} />
        ))}
      </div>
      <div className="plot-cycle" style={{ width: `${Math.min(100, plot.cycleProgress * 100)}%` }} />
    </button>
  );
}

function LockedPlotGridCard({
  save,
  plotId,
  balanceReady,
  purchaseBusy,
  onUnlock,
  onInsufficientFunds,
  onLearn,
}: {
  save: GameSave;
  plotId: number;
  balanceReady: boolean;
  purchaseBusy: boolean;
  onUnlock: (id: number) => Promise<PurchaseResult>;
  onInsufficientFunds: () => Promise<void>;
  onLearn: () => void;
}) {
  const cat = getPlotCatalog(plotId);
  const cost = plotUnlockCost(plotId);
  const eligible = canBuyPlotUnlock(save, plotId);
  const canBuy = eligible && balanceReady && !purchaseBusy;
  const prev = save.plots.find((p) => p.id === plotId - 1);
  const blocked = plotId > 1 && !prev?.unlocked;

  const handleUnlock = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const r = await onUnlock(plotId);
    if (r === "insufficient") await onInsufficientFunds();
    else if (r === "offline") window.alert("Could not reach the server. Deploy farms API and run D1 migration.");
    else if (r === "unavailable") window.alert("Unlock not available yet.");
  };

  return (
    <div className="plot-card plot-card--grid plot-card-locked" data-plot-id={plotId}>
      <span className="plot-icon" aria-hidden>
        🔒
      </span>
      <div className="plot-card-main">
        <p className="plot-name">{cat.name}</p>
        <p className="plot-sub plot-sub--sci">{cat.scientificName}</p>
        <p className="plot-sub">{blocked ? "Unlock previous plot first" : `Unlock · ${formatRu(cost)}`}</p>
      </div>
      <div className="plot-card-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onLearn}>
          Learn
        </button>
        {!blocked ? (
          <button type="button" className="btn btn-primary btn-sm" disabled={purchaseBusy || !canBuy} onClick={(e) => void handleUnlock(e)}>
            {formatRu(cost)}
          </button>
        ) : null}
      </div>
    </div>
  );
}
