import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CategoryId, IslandId, SavedTrip, TabId } from "../types";

export interface AppState {
  onboardingComplete: boolean;
  selectedIslandId: IslandId | null;
  activeTab: TabId;
  favorites: string[];
  savedTrips: SavedTrip[];
  userNotes: Record<string, string>;
  darkMode: boolean;
  largeText: boolean;
  culturalTipSeen: boolean;
  exploreCategory: CategoryId | null;
  exploreSubFilter: string | null;
  selectedPlaceId: string | null;
  searchQuery: string;

  completeOnboarding: (islandId: IslandId) => void;
  setIsland: (islandId: IslandId) => void;
  setTab: (tab: TabId) => void;
  toggleFavorite: (placeId: string) => void;
  isFavorite: (placeId: string) => boolean;
  addSavedTrip: (trip: Omit<SavedTrip, "id" | "createdAt">) => void;
  removeSavedTrip: (tripId: string) => void;
  setUserNote: (placeId: string, note: string) => void;
  setDarkMode: (v: boolean) => void;
  setLargeText: (v: boolean) => void;
  setCulturalTipSeen: (v: boolean) => void;
  setExploreCategory: (cat: CategoryId | null, subFilter?: string | null) => void;
  openPlace: (placeId: string | null) => void;
  setSearchQuery: (q: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      onboardingComplete: false,
      selectedIslandId: null,
      activeTab: "home",
      favorites: [],
      savedTrips: [],
      userNotes: {},
      darkMode: true,
      largeText: false,
      culturalTipSeen: false,
      exploreCategory: null,
      exploreSubFilter: null,
      selectedPlaceId: null,
      searchQuery: "",

      completeOnboarding: (islandId) =>
        set({ onboardingComplete: true, selectedIslandId: islandId, activeTab: "home" }),

      setIsland: (islandId) => set({ selectedIslandId: islandId }),

      setTab: (tab) => set({ activeTab: tab, selectedPlaceId: null }),

      toggleFavorite: (placeId) =>
        set((s) => ({
          favorites: s.favorites.includes(placeId)
            ? s.favorites.filter((id) => id !== placeId)
            : [...s.favorites, placeId],
        })),

      isFavorite: (placeId) => get().favorites.includes(placeId),

      addSavedTrip: (trip) =>
        set((s) => ({
          savedTrips: [
            {
              ...trip,
              id: `trip-${Date.now()}`,
              createdAt: new Date().toISOString(),
            },
            ...s.savedTrips,
          ],
        })),

      removeSavedTrip: (tripId) =>
        set((s) => ({ savedTrips: s.savedTrips.filter((t) => t.id !== tripId) })),

      setUserNote: (placeId, note) =>
        set((s) => ({ userNotes: { ...s.userNotes, [placeId]: note } })),

      setDarkMode: (v) => set({ darkMode: v }),
      setLargeText: (v) => set({ largeText: v }),
      setCulturalTipSeen: (v) => set({ culturalTipSeen: v }),

      setExploreCategory: (cat, subFilter = null) =>
        set({ exploreCategory: cat, exploreSubFilter: subFilter }),

      openPlace: (placeId) => set({ selectedPlaceId: placeId }),

      setSearchQuery: (q) => set({ searchQuery: q }),
    }),
    {
      name: "visiting-hawaii-v1",
      partialize: (s) => ({
        onboardingComplete: s.onboardingComplete,
        selectedIslandId: s.selectedIslandId,
        favorites: s.favorites,
        savedTrips: s.savedTrips,
        userNotes: s.userNotes,
        darkMode: s.darkMode,
        largeText: s.largeText,
        culturalTipSeen: s.culturalTipSeen,
      }),
    },
  ),
);
