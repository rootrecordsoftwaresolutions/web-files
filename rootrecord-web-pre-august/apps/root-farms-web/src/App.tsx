import { useState } from "react";
import { AuthScreen } from "./components/AuthScreen";
import { BetaTesterBanner } from "./components/BetaTesterBanner";
import { PlaceholderTab } from "./components/PlaceholderTab";
import { RootEconomyScreen } from "./components/RootEconomyScreen";
import { PlotDetailScreen } from "./components/PlotDetailScreen";
import { PlotsGridScreen } from "./components/PlotsGridScreen";
import { SettingsScreen } from "./components/SettingsScreen";
import { FarmhandsScreen } from "./components/FarmhandsScreen";
import { GuideScreen } from "./components/GuideScreen";
import { MarketScreen } from "./components/MarketScreen";
import { OrchardsScreen } from "./components/OrchardsScreen";
import { TierPlotsScreen } from "./components/TierPlotsScreen";
import { TransactionsScreen } from "./components/TransactionsScreen";
import {
  vegetableGrowSec,
  vegetableName,
  vegetableScientificName,
  vegetableRowCost,
  vegetableUnlockCost,
} from "./game/tier-catalog";
import { useGame } from "./contexts/GameContext";
import { vegetablesProtected } from "./game/storeCatalog";
import { BottomNav } from "./components/BottomNav";
import { MobileWebHeader } from "./components/MobileWebHeader";
import { SideNav } from "./components/SideNav";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { VarmintAlertModal } from "./components/VarmintAlertModal";
import { WelcomeBackModal } from "./components/WelcomeBackModal";
import { GameProvider } from "./contexts/GameContext";
import { vegetablePlotHarvestTotal } from "./game/tier-income";
import type { TabId } from "./game/types";
import { AdSenseAd } from "./components/AdSenseAd";

function TierTabBody({
  tier,
}: {
  tier: "orchards" | "vegetables";
}) {
  const {
    orchardAppBonus,
    membershipBonus,
    vegetables,
    vegetablesUnlocked,
    rootLevel,
    purchaseTier,
    purchaseBusy,
    handleInsufficientFunds,
    store,
    farmhandCheckin,
  } = useGame();
  if (tier === "orchards") {
    return <OrchardsScreen orchardAppBonus={orchardAppBonus} membershipBonus={membershipBonus} store={store} rootLevel={rootLevel} />;
  }
  return (
    <TierPlotsScreen
      title="Vegetable plots"
      lead={`Separate tier unlocked at farm level 20 (you are level ${rootLevel}). Protection requires the lightning meteorologist's rod plus any active farmhand: ${
        farmhandCheckin?.active && vegetablesProtected(store) ? "active" : "not active"
      }.`}
      plots={vegetables}
      locked={!vegetablesUnlocked}
      lockedMessage="Reach farm level 20 from combined plots and rows to unlock vegetable plots."
      unlockKind="vegetable_unlock"
      rowKind="vegetable_row"
      nameFor={vegetableName}
      descriptionFor={vegetableScientificName}
      growSecFor={vegetableGrowSec}
      harvestFor={vegetablePlotHarvestTotal}
      unlockCostFor={vegetableUnlockCost}
      rowCostFor={vegetableRowCost}
      onPurchase={async (kind, id) => {
        const r = await purchaseTier(kind, id);
        if (r === "insufficient") await handleInsufficientFunds();
        else if (r === "offline") window.alert("Could not reach the server. Try again after reconnecting.");
        else if (r === "unavailable") window.alert("Purchase not available yet.");
      }}
      purchaseBusy={purchaseBusy}
    />
  );
}

function RootFarmsWebApp({ onSignIn }: { onSignIn: () => void }) {
  const initialTab: TabId =
    typeof window !== "undefined" && /\/chart\/transactions\/?$/i.test(window.location.pathname) ? "transactions" : "plots";
  const [tab, setTab] = useState<TabId>(initialTab);
  const [plotId, setPlotId] = useState<number | null>(null);

  const onTab = (t: TabId) => {
    setTab(t);
    setPlotId(null);
    if (typeof window !== "undefined") {
      const path = t === "transactions" ? "/chart/transactions" : "/";
      if (window.location.pathname !== path) window.history.replaceState(null, "", path);
    }
  };

  let body: React.ReactNode;
  if (tab === "plots") {
    body = <PlotsGridScreen onOpenPlot={setPlotId} onOpenTier={onTab} showRootGrid={false} />;
  } else if (tab === "roots") {
    body =
      plotId != null ? (
        <PlotDetailScreen plotId={plotId} onBack={() => setPlotId(null)} variant="web" />
      ) : (
        <PlotsGridScreen onOpenPlot={setPlotId} onOpenTier={onTab} showSummary={false} />
      );
  } else if (tab === "orchards") {
    body = <TierTabBody tier="orchards" />;
  } else if (tab === "vegetables") {
    body = <TierTabBody tier="vegetables" />;
  } else if (tab === "farmhands") {
    body = <FarmhandsScreen />;
  } else if (tab === "market") {
    body = <MarketScreen />;
  } else if (tab === "transactions") {
    body = <TransactionsScreen />;
  } else if (tab === "guide") {
    body = <GuideScreen />;
  } else if (tab === "settings") {
    body = <SettingsScreen onSignIn={onSignIn} />;
  } else if (tab === "leaderboard") {
    body = <RootEconomyScreen variant="web" />;
  } else {
    body = <PlaceholderTab title="Replant" blurb="Reset for permanent multipliers — prestige for Root Farms." />;
  }

  return (
    <div className="app-shell app-shell--web">
      <SideNav tab={tab} onTab={onTab} />
      <div className="app-main-column">
        <MobileWebHeader />
        <main className="app-main app-main--web">
          <BetaTesterBanner onSignIn={onSignIn} />
          <AdSenseAd placement="top" />
          {body}
          <AdSenseAd placement="bottom" />
        </main>
      </div>
      <BottomNav tab={tab} onTab={onTab} />
      <WelcomeBackModal />
      <VarmintAlertModal />
    </div>
  );
}

function RootFarmsGate() {
  const auth = useAuth();
  const [showSignIn, setShowSignIn] = useState(false);

  if (!auth.decided) {
    return <div className="boot">Loading…</div>;
  }

  if (showSignIn && !auth.authed) {
    return (
      <div className="auth-ad-shell">
        <AdSenseAd placement="top" />
        <AuthScreen onContinueAsBetaTester={() => setShowSignIn(false)} />
        <AdSenseAd placement="bottom" />
      </div>
    );
  }

  if (!auth.canPlay) {
    return (
      <div className="auth-ad-shell">
        <AdSenseAd placement="top" />
        <AuthScreen onContinueAsBetaTester={() => setShowSignIn(false)} />
        <AdSenseAd placement="bottom" />
      </div>
    );
  }

  return (
    <GameProvider>
      <RootFarmsWebApp onSignIn={() => setShowSignIn(true)} />
    </GameProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <RootFarmsGate />
    </AuthProvider>
  );
}
