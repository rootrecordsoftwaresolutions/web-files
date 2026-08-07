import type { SponsoredListing } from "../lib/sponsoredApi";

interface Props {
  listing: SponsoredListing;
  onClose: () => void;
}

export function SponsoredListingDetail({ listing, onClose }: Props) {
  const cta = listing.ctaUrl || listing.websiteUrl;
  const ctaLabel = listing.ctaLabel || (listing.websiteUrl ? "Visit website" : "Learn more");

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal-sheet fade-in" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div
          className="modal-sheet__hero"
          style={{
            backgroundImage: `linear-gradient(to top, rgba(6,24,36,0.85), transparent 50%), url(${listing.imageUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            minHeight: 180,
          }}
        >
          <button type="button" className="modal-sheet__close" onClick={onClose} aria-label="Close">
            ×
          </button>
          <span className="chip chip--sunset" style={{ position: "absolute", left: "1rem", bottom: "1rem" }}>
            Sponsored · {listing.businessName}
          </span>
        </div>
        <div className="modal-sheet__body">
          <h2>{listing.title}</h2>
          <p style={{ margin: 0, color: "var(--text-muted)", lineHeight: 1.55 }}>{listing.description}</p>
          {listing.addressLine && (
            <div className="modal-sheet__section">
              <h3>Location</h3>
              <p style={{ margin: 0 }}>{listing.addressLine}</p>
            </div>
          )}
          {cta && (
            <a className="btn btn--sunset" href={cta} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", marginTop: "1rem" }}>
              {ctaLabel}
            </a>
          )}
          <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "1.25rem" }}>
            Paid local partner listing in Visiting Hawaiʻi. RootRecord reviews listings for relevance; report issues via rootrecord.info/contact.
          </p>
        </div>
      </div>
    </div>
  );
}
