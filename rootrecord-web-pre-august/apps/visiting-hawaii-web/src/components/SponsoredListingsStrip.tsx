import { useEffect, useState } from "react";
import { fetchSponsoredListings, type SponsoredListing } from "../lib/sponsoredApi";
import type { CategoryId, IslandId } from "../types";
import { SponsoredListingCard } from "./SponsoredListingCard";
import { SponsoredListingDetail } from "./SponsoredListingDetail";

interface Props {
  islandId: IslandId;
  categoryId?: CategoryId | null;
  title?: string;
}

export function SponsoredListingsStrip({ islandId, categoryId, title = "Local partners" }: Props) {
  const [listings, setListings] = useState<SponsoredListing[]>([]);
  const [selected, setSelected] = useState<SponsoredListing | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await fetchSponsoredListings({ islandId, categoryId: categoryId ?? undefined, limit: 2 });
      if (!cancelled) setListings(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [islandId, categoryId]);

  if (!listings.length) return null;

  return (
    <>
      <h2 className="section-title">{title}</h2>
      <p className="section-lead">Featured local businesses — rotated fairly among paid partners.</p>
      <div className="grid-places">
        {listings.map((l) => (
          <SponsoredListingCard key={l.id} listing={l} onClick={() => setSelected(l)} />
        ))}
      </div>
      {selected && <SponsoredListingDetail listing={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
