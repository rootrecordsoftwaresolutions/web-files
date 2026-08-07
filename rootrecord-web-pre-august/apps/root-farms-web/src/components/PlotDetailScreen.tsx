import { PLOT_COUNT, getPlotCatalog, plotRuPerCycle, rowSlotCost } from "../game/catalog";
import { formatGrowTime, formatRu } from "../game/format";
import { useGame } from "../contexts/GameContext";
import { AccountBalanceHud } from "./AccountBalanceHud";
import { RootFactsPanel } from "./RootFactsPanel";

export function PlotDetailScreen({
  plotId,
  onBack,
  variant = "web",
}: {
  plotId: number;
  onBack: () => void;
  variant?: "web" | "mobile";
}) {
  const { save, purchaseRowSlot, purchaseBusy, balanceReady, handleInsufficientFunds } = useGame();
  const plot = save.plots.find((p) => p.id === plotId);
  const cat = getPlotCatalog(plotId);

  if (!plot?.unlocked) {
    return (
      <div className={`screen plot-detail plot-detail--${variant}`}>
        <button type="button" className="back-btn" onClick={onBack}>
          ← Plots
        </button>
        <AccountBalanceHud variant={variant} className="plot-detail-balance-hud" />
        <header className={`detail-hero accent-${cat.accent}`}>
          <p className="detail-plot-num">
            Plot {plotId} / {PLOT_COUNT}
          </p>
          <h1>{cat.name}</h1>
        </header>
        <RootFactsPanel cat={cat} />
        <p className="plot-locked-hint">Unlock from the field map to start growing this root.</p>
      </div>
    );
  }

  const perHarvest = plotRuPerCycle(cat, plot.rowsActive, plot.rowCount);
  const full = plot.rowsActive >= cat.maxRows;
  const slotsLeft = cat.maxRows - plot.rowCount;
  const nextCost = slotsLeft > 0 ? rowSlotCost(plotId, plot.rowCount) : 0;
  const canBuyRow = slotsLeft > 0 && balanceReady && !purchaseBusy;

  const onBuyRow = async () => {
    const r = await purchaseRowSlot(plotId);
    if (r === "insufficient") await handleInsufficientFunds();
    else if (r === "offline") window.alert("Could not reach the server. Deploy farms API and run D1 migration.");
  };

  return (
    <div className={`screen plot-detail plot-detail--${variant}`}>
      <button type="button" className="back-btn" onClick={onBack}>
        ← Plots
      </button>
      <AccountBalanceHud variant={variant} className="plot-detail-balance-hud" />

      <header className={`detail-hero accent-${cat.accent}`} data-plot-id={plotId}>
        <p className="detail-plot-num">
          Plot {plotId} / {PLOT_COUNT}
        </p>
        <h1>{cat.name}</h1>
        <p>
          {plot.rowsActive} rows growing · {formatGrowTime(cat.growTimeSec)} cycle
        </p>
      </header>

      <RootFactsPanel cat={cat} />

      <div className="stat-row">
        <div>
          <span className="stat-k">ROWS</span>
          <span className="stat-v">
            {plot.rowsActive} / {cat.maxRows}
          </span>
        </div>
        <div>
          <span className="stat-k">RU / harvest</span>
          <span className="stat-v">{formatRu(perHarvest)}</span>
        </div>
        <div>
          <span className="stat-k">GROW TIME</span>
          <span className="stat-v">{formatGrowTime(cat.growTimeSec)}</span>
        </div>
      </div>

      <p className="section-head">
        <span>ROWS</span>
        <span>{slotsLeft} slots available</span>
      </p>

      <div className={`row-grid row-grid--${variant}`}>
        {Array.from({ length: plot.rowCount }, (_, i) => (
          <div
            key={i}
            className={`row-card accent-${cat.accent}`}
            data-plot-id={plotId}
            style={{ ["--grow" as any]: Math.min(1, Math.max(0, plot.cycleProgress)) }}
          >
            <span className="row-plant" aria-hidden>
              <span className="row-plant-leaf row-plant-leaf--l" />
              <span className="row-plant-leaf row-plant-leaf--r" />
              <span className="row-plant-stem" />
            </span>
            <p className="row-name">Row {i + 1}</p>
            <p className="row-rate">{formatRu(cat.baseRuPerRow)} / harvest</p>
            <div className="row-progress" style={{ width: `${Math.min(100, plot.cycleProgress * 100)}%` }} />
          </div>
        ))}
        {slotsLeft > 0 ? (
          <button
            type="button"
            className="row-card row-card-buy"
            disabled={purchaseBusy || !canBuyRow}
            onClick={() => void onBuyRow()}
          >
            <span className="row-icon" aria-hidden>
              +
            </span>
            <p className="row-name">Plant Row</p>
            <p className="row-rate">{formatRu(nextCost)}</p>
          </button>
        ) : null}
      </div>

      {full ? <p className="plot-bonus">+10% full field bonus</p> : null}

      <p className="upgrade-head">UPGRADES</p>
      <div className="upgrade-card">
        <div>
          <p className="upgrade-title">More rows</p>
          <p className="upgrade-sub">
            {plot.rowCount} / {cat.maxRows} rows
          </p>
          <div className="seg-bar" aria-hidden>
            {Array.from({ length: cat.maxRows }, (_, i) => (
              <span key={i} className={i < plot.rowCount ? "on" : ""} />
            ))}
          </div>
        </div>
        {slotsLeft > 0 ? (
          <button type="button" className="btn btn-primary" disabled={purchaseBusy || !canBuyRow} onClick={() => void onBuyRow()}>
            {formatRu(nextCost)}
          </button>
        ) : (
          <span className="upgrade-muted">At capacity</span>
        )}
      </div>
    </div>
  );
}
