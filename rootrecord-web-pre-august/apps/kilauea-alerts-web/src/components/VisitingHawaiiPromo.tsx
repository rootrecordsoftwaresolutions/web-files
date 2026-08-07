/** Marketing site product page — waitlist lives at #waitlist on the same URL. */
export const VISITING_HAWAII_URL = "https://rootrecord.info/visiting-hawaii.html";

/**
 * Promotes the upcoming Visiting Hawaiʻi travel guide (all islands, offline-first).
 */
export function VisitingHawaiiPromo() {
  return (
    <section className="panel visiting-hawaii-promo" data-testid="visiting-hawaii-promo" aria-labelledby="visiting-hawaii-promo-title">
      <div className="visiting-hawaii-promo-inner">
        <div className="visiting-hawaii-promo-copy">
          <span className="visiting-hawaii-promo-tag">Coming soon from RootRecord</span>
          <h2 id="visiting-hawaii-promo-title" className="visiting-hawaii-promo-title">
            Visiting Hawaiʻi
          </h2>
          <p className="muted small visiting-hawaii-promo-lead">
            Planning beyond the volcano? Our upcoming guide covers all six visitor islands with offline maps,
            local spots, and a mālama ʻāina mindset — not tourist-trap lists.
          </p>
        </div>
        <a
          className="btn btn-secondary visiting-hawaii-promo-cta"
          href={VISITING_HAWAII_URL}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="visiting-hawaii-promo-link"
        >
          Learn more &amp; join waitlist
        </a>
      </div>
    </section>
  );
}
