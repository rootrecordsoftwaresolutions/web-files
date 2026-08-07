import { useMemo } from "react";
import { useGame } from "../contexts/GameContext";
import { formatRu, formatRuRate } from "../game/format";
import {
  protectionIncomeMultiplier,
  STORE_PROTECTIONS,
  storeHasFarmhandTool,
  vegetablesProtected,
  type ProtectionKind,
  type StoreProtectionItem,
  type StoreToggleKind,
} from "../game/storeCatalog";
import { totalRuPerSec } from "../game/sim";

const FIELD_KINDS = new Set<ProtectionKind>(["gopher", "mice", "rabbit", "birds"]);

function storeToggleOn(
  store: ReturnType<typeof useGame>["store"],
  kind: StoreToggleKind,
): boolean {
  if (kind === "gopher" || kind === "mice" || kind === "rabbit" || kind === "birds") return store.protections[kind];
  if (kind === "lightning_meteorologist") return store.lightning_meteorologist;
  return store.cypress_trees;
}

export function FarmhandsScreen() {
  const {
    save,
    spendableBalance,
    balanceReady,
    store,
    farmhandCheckin,
    ruPerSec,
    protectionFeePerMinute,
    storeBusy,
    purchaseBusy,
    toggleStore,
    purchaseTier,
    handleInsufficientFunds,
    lightningRow,
    varmintNotifications,
  } = useGame();

  const incomeMult = protectionIncomeMultiplier(store);
  const grossRuPerSec = totalRuPerSec(save, 1);
  const reductionPct = Math.round((1 - incomeMult) * 1000) / 10;

  const reductionHint = useMemo(() => {
    if (!balanceReady || reductionPct <= 0) return null;
    return `${reductionPct}% lower income rate (−${formatRu(protectionFeePerMinute)}/min vs full rate)`;
  }, [balanceReady, reductionPct, protectionFeePerMinute]);

  const fieldItems = STORE_PROTECTIONS.filter((i) => FIELD_KINDS.has(i.kind as ProtectionKind));
  const stormItems = STORE_PROTECTIONS.filter((i) => !FIELD_KINDS.has(i.kind as ProtectionKind));

  const onBuyFarmhandTool = async (item: StoreProtectionItem) => {
    const r = await purchaseTier(item.toolPurchaseKind, 0);
    if (r === "insufficient") await handleInsufficientFunds();
    else if (r === "offline") window.alert("Could not reach the server. Try again after reconnecting.");
    else if (r === "unavailable") window.alert(`${item.toolName} is not available.`);
  };

  return (
    <div className="screen store-screen farmhands-screen">
      <header className="store-header">
        <div>
          <h1>Farmhands</h1>
          <p className="store-lead">
            Buy each helper's tool once, then hire protection and storm gear. Active helpers lower your farm income
            rate; tool purchases spend from your Root Unit balance.
          </p>
        </div>
        <div className="store-balance" aria-live="polite">
          <p className="store-balance-val">{balanceReady ? formatRu(spendableBalance) : "—"}</p>
          <p className="store-balance-label">Available Root Units</p>
        </div>
      </header>

      {balanceReady ? (
        <p className="store-notice store-notice--live">
          Income rate <strong>{formatRuRate(ruPerSec)}</strong>
          {grossRuPerSec > ruPerSec ? (
            <>
              {" "}
              <span className="store-notice-muted">(full rate {formatRuRate(grossRuPerSec)})</span>
            </>
          ) : null}
          {reductionHint ? <> · {reductionHint}</> : null}
        </p>
      ) : (
        <p className="store-notice">Sign in to manage farmhand plans.</p>
      )}

      {lightningRow != null ? (
        <p className="store-notice">
          Shared lightning row today: <strong>row {lightningRow}</strong>. Once lightning is unlocked, that row can be hit anywhere in the unlocked field.
        </p>
      ) : null}

      <p className="store-notice">
        Vegetable protection: <strong>{farmhandCheckin?.active && vegetablesProtected(store) ? "active" : "inactive"}</strong>{" "}
        — requires the lightning meteorologist's rod plus at least one active farmhand.
        {farmhandCheckin?.expires_at ? ` Farmhand check-in expires ${new Date(farmhandCheckin.expires_at).toLocaleString()}.` : " Log in to Root Farms every 48 hours to keep farmhands protecting the farm."}
      </p>

      <p className="store-notice store-notice--disclaimer">
        Game rules, income rates, fees, and other details may change at any time without notice.
      </p>

      {varmintNotifications.length > 0 ? (
        <section className="store-notifications" aria-label="Farm notifications">
          <h2 className="store-notifications-title">Notifications</h2>
          <ul className="store-notifications-list">
            {varmintNotifications.slice(0, 8).map((e) => (
              <li key={e.id}>{e.message}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="section-head">
        <span>Field hazards</span>
        <span>Income rate</span>
      </div>

      <ul className="store-grid">
        {fieldItems.map((item) => {
          const on = storeToggleOn(store, item.kind);
          const toolOwned = storeHasFarmhandTool(store, item.kind);
          return (
            <li key={item.kind}>
              <article className={`store-card${on ? " store-card--active" : ""}`}>
                <div className="store-card-top">
                  <h2>{item.title}</h2>
                  <span className={`store-card-badge${on || toolOwned ? " store-card-badge--on" : ""}`}>
                    {on ? "On" : toolOwned ? "Ready" : "Tool needed"}
                  </span>
                </div>
                <p className="store-card-blurb">{item.blurb}</p>
                <p className="store-card-blurb">
                  Requires {item.toolName.toLowerCase()} before this helper can be hired.
                </p>
                <div className="store-card-foot">
                  <span className="store-card-cost">
                    {toolOwned ? item.feePctLabel : `${formatRu(item.oneTimeCost)} tool`}
                  </span>
                  <button
                    type="button"
                    className={`btn store-card-btn${on ? " btn-ghost" : " btn-primary"}`}
                    disabled={!balanceReady || storeBusy || purchaseBusy}
                    onClick={() => void (toolOwned ? toggleStore(item.kind, !on) : onBuyFarmhandTool(item))}
                  >
                    {storeBusy || purchaseBusy ? "…" : toolOwned ? (on ? "Turn off" : "Hire helper") : item.toolAction}
                  </button>
                </div>
              </article>
            </li>
          );
        })}
      </ul>

      <div className="section-head">
        <span>Storm hazards</span>
        <span>Income / cost</span>
      </div>

      <ul className="store-grid">
        {stormItems.map((item) => {
          const on = storeToggleOn(store, item.kind);
          const toolOwned = storeHasFarmhandTool(store, item.kind);
          return (
            <li key={item.kind}>
              <article className={`store-card${on ? " store-card--active" : ""}`}>
                <div className="store-card-top">
                  <h2>{item.title}</h2>
                  <span className={`store-card-badge${on || toolOwned ? " store-card-badge--on" : ""}`}>
                    {on ? "On" : toolOwned ? "Ready" : "Tool needed"}
                  </span>
                </div>
                <p className="store-card-blurb">{item.blurb}</p>
                <p className="store-card-blurb">
                  Requires {item.toolName.toLowerCase()} before this helper can be hired.
                </p>
                <div className="store-card-foot">
                  <span className="store-card-cost">
                    {toolOwned ? item.feePctLabel : `${formatRu(item.oneTimeCost)} tool`}
                  </span>
                  <button
                    type="button"
                    className={`btn store-card-btn${on ? " btn-ghost" : " btn-primary"}`}
                    disabled={!balanceReady || storeBusy || purchaseBusy}
                    onClick={() => void (toolOwned ? toggleStore(item.kind, !on) : onBuyFarmhandTool(item))}
                  >
                    {storeBusy || purchaseBusy ? "…" : toolOwned ? (on ? "Turn off" : "Hire helper") : item.toolAction}
                  </button>
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
