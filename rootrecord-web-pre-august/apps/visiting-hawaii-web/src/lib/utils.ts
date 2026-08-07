import type { Place } from "../types";

export function filterPlaces(
  places: Place[],
  opts: { query?: string; category?: string | null; subFilter?: string | null },
): Place[] {
  let list = places;
  if (opts.category) list = list.filter((p) => p.category === opts.category);
  if (opts.subFilter) list = list.filter((p) => p.subFilters.includes(opts.subFilter!));
  const q = (opts.query ?? "").trim().toLowerCase();
  if (q) {
    list = list.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.shortDescription.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        (p.localTips ?? []).some((t) => t.toLowerCase().includes(q)),
    );
  }
  return list;
}

export function malamaLabel(rating: number): string {
  if (rating >= 5) return "Excellent stewardship";
  if (rating >= 4) return "Strong mālama";
  if (rating >= 3) return "Mixed — tread carefully";
  return "High impact — learn before visiting";
}

export function costLabel(c: string): string {
  if (c === "free") return "Free";
  return c;
}
