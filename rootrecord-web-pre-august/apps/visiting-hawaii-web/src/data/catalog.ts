import type { CategoryMeta, Island } from "../types";

export const ISLANDS: Island[] = [
  {
    id: "oahu",
    name: "Oʻahu",
    nickname: "The Gathering Place",
    tagline: "Where city pulse meets legendary surf",
    vibe: "Urban energy + beaches",
    heroGradient: "linear-gradient(135deg, #0a2a43 0%, #1a5f7a 40%, #e07a3a 100%)",
    center: { lat: 21.4389, lng: -158.0001 },
    zoom: 10,
  },
  {
    id: "maui",
    name: "Maui",
    nickname: "The Valley Isle",
    tagline: "Sunrise summits and winding coastal roads",
    vibe: "Dramatic nature & adventure",
    heroGradient: "linear-gradient(135deg, #0d3d2e 0%, #1a6b4f 45%, #f4a261 100%)",
    center: { lat: 20.7984, lng: -156.3319 },
    zoom: 9,
  },
  {
    id: "kauai",
    name: "Kauaʻi",
    nickname: "The Garden Isle",
    tagline: "Emerald cliffs and ancient valleys",
    vibe: "Lush & untamed",
    heroGradient: "linear-gradient(135deg, #0a3328 0%, #2d6a4f 50%, #52b788 100%)",
    center: { lat: 22.0964, lng: -159.5261 },
    zoom: 10,
  },
  {
    id: "hawaii",
    name: "Hawaiʻi",
    nickname: "Big Island",
    tagline: "Volcanoes, black sand, and star-filled skies",
    vibe: "Raw geology & wide horizons",
    heroGradient: "linear-gradient(135deg, #1a0a0a 0%, #4a1942 40%, #e85d04 100%)",
    center: { lat: 19.5429, lng: -155.6659 },
    zoom: 8,
  },
  {
    id: "molokai",
    name: "Molokaʻi",
    nickname: "The Friendly Isle",
    tagline: "Slow rhythms and deep cultural roots",
    vibe: "Quiet & authentic",
    heroGradient: "linear-gradient(135deg, #1e3a5f 0%, #2d6a4f 60%, #d4a574 100%)",
    center: { lat: 21.1444, lng: -157.0226 },
    zoom: 11,
  },
  {
    id: "lanai",
    name: "Lānaʻi",
    nickname: "The Pineapple Isle",
    tagline: "Small island, big quiet",
    vibe: "Off-grid luxury & solitude",
    heroGradient: "linear-gradient(135deg, #264653 0%, #2a9d8f 50%, #e9c46a 100%)",
    center: { lat: 20.8267, lng: -156.9229 },
    zoom: 11,
  },
];

export const CATEGORIES: CategoryMeta[] = [
  {
    id: "beaches",
    label: "Beaches",
    icon: "🌊",
    description: "Snorkel coves, surf breaks, and hidden shores — with safety and respect for locals.",
    subFilters: ["snorkel", "surf", "black-sand", "hidden", "family"],
  },
  {
    id: "hikes",
    label: "Hikes & Nature",
    icon: "🥾",
    description: "Trails with difficulty, permits, and cultural context.",
    subFilters: ["easy", "moderate", "hard", "waterfall", "ridge"],
  },
  {
    id: "culture",
    label: "Culture & History",
    icon: "🏛️",
    description: "Heiau, museums, language, and community-led experiences.",
    subFilters: ["heiau", "museum", "luau", "language"],
  },
  {
    id: "food",
    label: "Food & Drink",
    icon: "🍽️",
    description: "Local plate lunch, poke, farm tables, and island coffee.",
    subFilters: ["poke", "plate-lunch", "farm-to-table", "coffee"],
  },
  {
    id: "adventure",
    label: "Adventure",
    icon: "🛶",
    description: "Snorkel tours, kayak, zip-line — prefer local operators.",
    subFilters: ["snorkel", "kayak", "helicopter", "zip-line"],
  },
  {
    id: "drives",
    label: "Scenic Drives",
    icon: "🚗",
    description: "Road trips with stops, timing tips, and pullouts.",
    subFilters: ["coastal", "mountain", "loop"],
  },
  {
    id: "hidden",
    label: "Hidden Gems",
    icon: "✨",
    description: "Local favorites, events, and sustainable picks.",
    subFilters: ["local-fav", "sunrise", "sunset", "sustainable"],
  },
  {
    id: "practical",
    label: "Practical Info",
    icon: "ℹ️",
    description: "Weather, safety, kapu, transport, and emergency basics.",
    subFilters: ["safety", "transport", "weather", "kapu"],
  },
];

export function islandById(id: string): Island | undefined {
  return ISLANDS.find((i) => i.id === id);
}

export function categoryById(id: string): CategoryMeta | undefined {
  return CATEGORIES.find((c) => c.id === id);
}
