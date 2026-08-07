import type { SponsoredListing } from "../lib/sponsoredApi";

interface Props {
  listing: SponsoredListing;
  onClick: () => void;
}

export function SponsoredListingCard({ listing, onClick }: Props) {
  return (
    <article
      className="place-card sponsored-card"
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      role="button"
      tabIndex={0}
    >
      <div
        className="place-card__thumb"
        style={{
          backgroundImage: `linear-gradient(to top, rgba(6,24,36,0.75), transparent 40%), url(${listing.imageUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div className="place-card__body">
        <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", alignItems: "flex-start" }}>
          <h3 className="place-card__title">{listing.title}</h3>
          <span className="chip chip--sunset">Sponsored</span>
        </div>
        <p className="place-card__desc" style={{ margin: "0 0 0.25rem", fontSize: "0.78rem", color: "var(--sunset)" }}>
          {listing.businessName}
        </p>
        <p className="place-card__desc">{listing.shortDescription}</p>
        <div className="place-card__meta">
          {listing.costRange && <span className="chip">{listing.costRange}</span>}
          <span className="chip">Local partner</span>
        </div>
      </div>
    </article>
  );
}
