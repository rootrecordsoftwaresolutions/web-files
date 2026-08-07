import { useEffect, useState } from "react";
import { placeById } from "./data/places";
import { useAppStore } from "./store/useAppStore";
import { AppHeader } from "./components/AppHeader";
import { BottomNav } from "./components/BottomNav";
import { CulturalTipModal } from "./components/CulturalTipModal";
import { ExploreScreen } from "./components/ExploreScreen";
import { HomeScreen } from "./components/HomeScreen";
import { IslandSelector } from "./components/IslandSelector";
import { MapScreen } from "./components/MapScreen";
import { PlaceDetail } from "./components/PlaceDetail";
import { ProfileScreen } from "./components/ProfileScreen";
import { SavedScreen } from "./components/SavedScreen";
import { SearchBar } from "./components/SearchBar";
import { SplashScreen } from "./components/SplashScreen";
import type { IslandId } from "./types";

function MainApp() {
  const [onboardingStep, setOnboardingStep] = useState<"splash" | "islands">("splash");
  const onboardingComplete = useAppStore((s) => s.onboardingComplete);
  const selectedIslandId = useAppStore((s) => s.selectedIslandId);
  const activeTab = useAppStore((s) => s.activeTab);
  const selectedPlaceId = useAppStore((s) => s.selectedPlaceId);
  const openPlace = useAppStore((s) => s.openPlace);
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);
  const darkMode = useAppStore((s) => s.darkMode);
  const largeText = useAppStore((s) => s.largeText);
  const searchQuery = useAppStore((s) => s.searchQuery);
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? "dark" : "light";
    document.documentElement.dataset.largeText = largeText ? "true" : "false";
  }, [darkMode, largeText]);

  if (!onboardingComplete || !selectedIslandId) {
    return (
      <div className="app-shell app-shell--no-nav">
        {onboardingStep === "splash" ? (
          <SplashScreen onContinue={() => setOnboardingStep("islands")} />
        ) : (
          <>
            <IslandSelector onSelect={(id: IslandId) => completeOnboarding(id)} />
            <p className="footer-credit">
              Built by <a href="https://rootrecord.info" target="_blank" rel="noopener noreferrer">RootRecord</a>
            </p>
          </>
        )}
      </div>
    );
  }

  const place = selectedPlaceId ? placeById(selectedPlaceId) : undefined;

  let body;
  switch (activeTab) {
    case "explore":
      body = <ExploreScreen />;
      break;
    case "map":
      body = <MapScreen />;
      break;
    case "saved":
      body = <SavedScreen />;
      break;
    case "profile":
      body = <ProfileScreen />;
      break;
    default:
      body = <HomeScreen />;
  }

  return (
    <div className="app-shell">
      <AppHeader />
      {activeTab !== "explore" && activeTab !== "map" && (
        <SearchBar value={searchQuery} onChange={setSearchQuery} />
      )}
      <main className="app-main">{body}</main>
      <BottomNav />
      <CulturalTipModal />
      {place && <PlaceDetail place={place} onClose={() => openPlace(null)} />}
    </div>
  );
}

export default function App() {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  if (!hydrated) {
    return (
      <div className="app-shell app-shell--no-nav">
        <div className="spinner" aria-label="Loading" />
      </div>
    );
  }

  return <MainApp />;
}
