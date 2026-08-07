import { useEffect, useState } from "react";
import { formatRu } from "../game/format";
import { useGame } from "../contexts/GameContext";
import { isAttackEvent, isBlockEvent } from "../game/storeCatalog";
import { hasAdFreeAccess } from "../lib/entitlement";
import { isNativeAdsAvailable, showRewardedAd, syncNativeAds } from "../lib/nativeAds";

export function WelcomeBackModal() {
  const { welcomeBack, resolveWelcomeBack, harvestBusy } = useGame();
  const [adBusy, setAdBusy] = useState(false);

  useEffect(() => {
    if (welcomeBack) syncNativeAds();
  }, [welcomeBack]);

  if (!welcomeBack) return null;

  const { harvestRu, varmintEvents } = welcomeBack;
  const pending = harvestRu ?? 0;
  const canDouble = pending > 0 && !hasAdFreeAccess() && isNativeAdsAvailable();

  const onWatchDouble = async () => {
    if (adBusy || harvestBusy) return;
    setAdBusy(true);
    try {
      const result = await showRewardedAd();
      if (result === "earned") resolveWelcomeBack(true);
    } finally {
      setAdBusy(false);
    }
  };

  return (
    <div className="contract-overlay" role="dialog" aria-modal="true" aria-labelledby="welcome-back-title">
      <div className="contract-card welcome-back-card">
        <h2 id="welcome-back-title" className="contract-title">
          Welcome back
        </h2>
        {pending > 0 ? (
          <>
            <p className="contract-lead">You earned {formatRu(pending)} while away</p>
            <p className="contract-amount">+{formatRu(pending)}</p>
            <p className="contract-hint">Harvest to add this to your account balance.</p>
            {canDouble ? (
              <p className="contract-hint contract-hint--double">Double your earnings?</p>
            ) : null}
          </>
        ) : (
          <p className="contract-lead">Good to see you again.</p>
        )}
        {varmintEvents.length > 0 ? (
          <div className="welcome-back-varmint">
            <p className="contract-lead">While you were away</p>
            <ul className="welcome-back-events">
              {varmintEvents.map((e) => (
                <li
                  key={e.id}
                  className={
                    isAttackEvent(e.kind)
                      ? "welcome-event welcome-event--attack"
                      : isBlockEvent(e.kind)
                        ? "welcome-event welcome-event--block"
                        : "welcome-event"
                  }
                >
                  {e.message}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {pending > 0 ? (
          <>
            <button
              type="button"
              className="btn btn-primary btn-contract-harvest"
              disabled={harvestBusy || adBusy}
              onClick={() => resolveWelcomeBack(false)}
            >
              {harvestBusy ? "Harvesting…" : `Harvest +${formatRu(pending)}`}
            </button>
            {canDouble ? (
              <button
                type="button"
                className="btn btn-contract-ad"
                disabled={harvestBusy || adBusy}
                onClick={() => void onWatchDouble()}
              >
                {adBusy ? "Loading ad…" : `Watch ad · 2× (+${formatRu(pending)} bonus)`}
              </button>
            ) : null}
          </>
        ) : (
          <button type="button" className="btn btn-primary" onClick={() => resolveWelcomeBack(false)}>
            Continue
          </button>
        )}
      </div>
    </div>
  );
}