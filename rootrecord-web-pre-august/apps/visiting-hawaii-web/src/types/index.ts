export type IslandId = "oahu" | "maui" | "kauai" | "hawaii" | "molokai" | "lanai";

export type CategoryId =
  | "beaches"
  | "hikes"
  | "culture"
  | "food"
  | "adventure"
  | "drives"
  | "hidden"
  | "practical";

export type TabId = "home" | "explore" | "map" | "saved" | "profile";

export type Difficulty = "easy" | "moderate" | "hard" | "expert";
export type CostRange = "free" | "$" | "$$" | "$$$";

export interface Island {
  id: IslandId;
  name: string;
  nickname: string;
  tagline: string;
  vibe: string;
  /** CSS gradient for hero cards when no photo */
  heroGradient: string;
  center: { lat: number; lng: number };
  zoom: number;
}

export interface Place {
  id: string;
  islandId: IslandId;
  category: CategoryId;
  subFilters: string[];
  title: string;
  shortDescription: string;
  description: string;
  lat: number;
  lng: number;
  difficulty?: Difficulty;
  duration?: string;
  bestTime?: string;
  costRange: CostRange;
  localTips?: string[];
  culturalNotes?: string;
  localVoice?: string;
  malamaRating: 1 | 2 | 3 | 4 | 5;
  safetyNotes?: string;
}

export interface SavedTrip {
  id: string;
  name: string;
  islandId: IslandId;
  placeIds: string[];
  template?: "1-day" | "3-day" | "family" | "adventure";
  createdAt: string;
}

export interface CategoryMeta {
  id: CategoryId;
  label: string;
  icon: string;
  description: string;
  subFilters: string[];
}
