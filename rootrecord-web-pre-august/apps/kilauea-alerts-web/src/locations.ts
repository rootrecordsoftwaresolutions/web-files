/** Mirrors `BigIslandLocations.kt` in the Android app (same ids + coordinates for `location_id`). */
export type BigIslandLocation = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
};

export const BIG_ISLAND_LOCATIONS: BigIslandLocation[] = [
  { id: "hilo", label: "Hilo", latitude: 19.7297, longitude: -155.09 },
  { id: "kona", label: "Kailua-Kona", latitude: 19.6406, longitude: -155.9956 },
  {
    id: "volcano",
    label: "Volcano Village / Hawaiʻi Volcanoes NP",
    latitude: 19.4194,
    longitude: -155.2888,
  },
  { id: "waimea", label: "Waimea (Kamuela)", latitude: 20.0233, longitude: -155.6719 },
  { id: "pahoa", label: "Pahoa", latitude: 19.4943, longitude: -154.9533 },
  { id: "waikoloa", label: "Waikoloa", latitude: 19.9375, longitude: -155.792 },
  { id: "honokaa", label: "Honokaʻa", latitude: 20.0773, longitude: -155.464 },
  { id: "naalehu", label: "Nāʻālehu", latitude: 19.06, longitude: -155.5861 },
  { id: "captain_cook", label: "Captain Cook", latitude: 19.4969, longitude: -155.9217 },
  {
    id: "south_point",
    label: "South Point / Ocean View",
    latitude: 18.9126,
    longitude: -155.6826,
  },
];
