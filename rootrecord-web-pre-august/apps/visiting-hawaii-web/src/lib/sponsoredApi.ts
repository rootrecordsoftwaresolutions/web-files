import { accountApiUrl } from "./accountApi";
import type { CategoryId, IslandId } from "../types";

export interface SponsoredListing {
  id: string;
  businessName: string;
  islandId: IslandId;
  categoryId: CategoryId;
  subFilters: string[];
  title: string;
  shortDescription: string;
  description: string;
  imageUrl: string;
  lat: number | null;
  lng: number | null;
  addressLine: string | null;
  costRange: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  websiteUrl: string | null;
  sponsored: true;
  status?: string;
  paidThrough?: string | null;
}

export type SponsoredApplicationPayload = {
  id?: string;
  strict?: boolean;
  businessName: string;
  contactEmail: string;
  contactPhone?: string;
  websiteUrl?: string;
  islandId: string;
  categoryId: string;
  subFilters?: string[];
  title: string;
  shortDescription: string;
  description: string;
  imageUrl: string;
  lat?: number | null;
  lng?: number | null;
  addressLine?: string;
  costRange?: string;
  ctaLabel?: string;
  ctaUrl?: string;
};

export async function fetchSponsoredListings(opts: {
  islandId?: IslandId;
  categoryId?: CategoryId;
  limit?: number;
}): Promise<SponsoredListing[]> {
  const q = new URLSearchParams();
  if (opts.islandId) q.set("island", opts.islandId);
  if (opts.categoryId) q.set("category", opts.categoryId);
  q.set("limit", String(opts.limit ?? 3));
  const res = await fetch(`${accountApiUrl("/api/visiting-hawaii/sponsored")}?${q}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { listings?: SponsoredListing[] };
  return Array.isArray(data.listings) ? data.listings : [];
}
