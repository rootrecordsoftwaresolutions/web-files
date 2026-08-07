import { AiLatestReport } from "./AiLatestReport";
import { AiPreviousReport } from "./AiPreviousReport";
import { EarthquakeChartsSection } from "./EarthquakeChartsSection";

/** Seismic charts + AI archive — rendered below the main weather/HVO dashboard. */
export function DashboardIntelSection({ ready }: { ready: boolean }) {
  if (!ready) {
    return (
      <section className="dashboard-below muted small" aria-live="polite">
        Loading seismic charts and AI archive…
      </section>
    );
  }
  return (
    <section className="dashboard-below" aria-labelledby="dashboard-below-heading">
      <div className="dashboard-below-head">
        <h2 id="dashboard-below-heading">Seismic activity &amp; AI briefs</h2>
        <p className="muted small">
          M1+ USGS charts and the two most recent Kīlauea hazard briefs (current and previous).
        </p>
      </div>
      <AiLatestReport />
      <AiPreviousReport />
      <EarthquakeChartsSection />
    </section>
  );
}
