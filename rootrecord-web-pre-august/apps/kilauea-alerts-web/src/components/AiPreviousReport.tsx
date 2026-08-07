import { useEffect, useState } from "react";
import { fetchPreviousAiReport, fmtReportUtc, type AiReportRow } from "../lib/kilaueaChartsApi";

function reportBody(r: AiReportRow): string {
  return (r.body || r.summary || "").trim();
}

export function AiPreviousReport() {
  const [report, setReport] = useState<AiReportRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchPreviousAiReport();
        if (cancelled) return;
        setReport(data.reports?.[0] ?? null);
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : String(e);
          setError(msg === "Failed to fetch" ? "Could not load the previous AI report." : msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="panel panel-ai-previous" aria-labelledby="ai-previous-heading">
      <div className="panel-head">
        <span className="panel-icon" aria-hidden>
          ◷
        </span>
        <h2 id="ai-previous-heading">Previous Kīlauea AI hazards brief</h2>
      </div>
      {loading ? <p className="muted">Loading previous AI report…</p> : null}
      {error ? <p className="muted" role="alert">{error}</p> : null}
      {!loading && !error && !report ? (
        <p className="muted">No earlier brief is stored yet.</p>
      ) : null}
      {report ? (
        <div className="ai-report-latest">
          <div className="ai-report-latest-meta muted small">
            {fmtReportUtc(report.created_at)}
            {report.source_type ? ` · ${report.source_type}` : ""}
            {report.magnitude != null ? ` · M${report.magnitude.toFixed(1)} trigger` : ""}
          </div>
          {report.headline ? <div className="ai-report-latest-headline">{report.headline}</div> : null}
          <pre className="ai-report-latest-body">{reportBody(report)}</pre>
        </div>
      ) : null}
    </section>
  );
}
