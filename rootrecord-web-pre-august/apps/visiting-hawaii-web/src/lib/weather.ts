import type { IslandId } from "../types";

/** Mock island weather — wire to rootrecord-api-weather later. */
export interface IslandWeather {
  summary: string;
  highF: number;
  lowF: number;
  wind: string;
  updated: string;
}

const MOCK: Record<IslandId, IslandWeather> = {
  oahu: { summary: "Partly cloudy, trades 15 mph", highF: 84, lowF: 72, wind: "NE 15", updated: "This morning" },
  maui: { summary: "Morning sun, afternoon clouds inland", highF: 82, lowF: 68, wind: "NE 12", updated: "This morning" },
  kauai: { summary: "Showers north shore, sun south", highF: 80, lowF: 70, wind: "NE 18", updated: "This morning" },
  hawaii: { summary: "Vog possible south Kona; Hilo showers", highF: 83, lowF: 69, wind: "E 10", updated: "This morning" },
  molokai: { summary: "Clear leeward, breezy", highF: 85, lowF: 71, wind: "NE 14", updated: "This morning" },
  lanai: { summary: "Sunny and dry", highF: 84, lowF: 70, wind: "NE 13", updated: "This morning" },
};

export function getIslandWeather(islandId: IslandId): IslandWeather {
  return MOCK[islandId];
}
