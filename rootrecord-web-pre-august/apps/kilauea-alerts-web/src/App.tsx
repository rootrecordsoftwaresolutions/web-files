import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { AuthScreen } from "./components/AuthScreen";
import { DashboardIntelSection } from "./components/DashboardIntelSection";
import { DetailModal } from "./components/DetailModal";
import { DeveloperMessage } from "./components/DeveloperMessage";
import { VisitingHawaiiPromo } from "./components/VisitingHawaiiPromo";
import { ProPaywall } from "./components/ProPaywall";
import { UpsellModal, UPSELL_EVENT } from "./components/UpsellModal";
import { useAuth } from "./contexts/AuthContext";
import { BIG_ISLAND_LOCATIONS, type BigIslandLocation } from "./locations";
import { apiFetch, getStoredToken, isPro, isLifeMember, RR_APP_ID } from "./lib/api";
import { startEarnUsageRewards } from "./lib/earnUsageRewards";

const FREE_TIER_LOC_ID = "volcano";
const ACCOUNT_SESSION_API = "https://rootrecord-api-account.rootrecord.workers.dev";

const IS_NATIVE = typeof window !== "undefined" && Boolean((window as { Capacitor?: { isNativePlatform?: () => boolean } })?.Capacitor?.isNativePlatform?.());
import {
  alertTitle,
  asRecord,
  buildDashboardView,
  hourlyDisplayTemp,
  hourlySlotWhen,
  quakeDetailRows,
  usgsTimeLabel,
  type DashboardView,
} from "./dashboardModel";

function dashboardPath(loc: BigIslandLocation, refresh: boolean): string {
  const q = new URLSearchParams({
    lat: String(loc.latitude),
    lon: String(loc.longitude),
    location_id: loc.id,
  });
  if (refresh) q.set("refresh", "1");
  return `/api/dashboard?${q.toString()}`;
}

function periodTemp(p: Record<string, unknown>): string {
  const raw = p.temperature ?? p.Temperature;
  const u = String(p.temperatureUnit ?? p.TemperatureUnit ?? "").trim().toUpperCase();
  if (raw == null || raw === "") return "—";
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return "—";
  // Imperial display: always emit °F. NWS Hawaiʻi often returns °C; convert.
  const f = u === "C" ? (n * 9) / 5 + 32 : n;
  return `${Math.round(f)}°F`;
}

/** Rewrite USGS `place` strings like "28 km E of …" → "17 mi E of …". */
function imperialPlace(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s) return "—";
  return s.replace(/(\d+(?:\.\d+)?)\s*km\b/gi, (_m, n) => `${Math.round(parseFloat(n) * 0.621371)} mi`);
}

/**
 * Forecast period label. AccuWeather (via api-kilauea) emits names as "Day 1"/"Night 1",
 * which is not what users want — replace with a human weekday in Pacific/Honolulu
 * (e.g. "Today" / "Tonight" / "Wednesday" / "Wednesday Night"). Falls back to the
 * server-supplied name if startTime is missing or unparseable.
 */
function periodLabel(p: Record<string, unknown>, index: number): string {
  const original = String(p.name || p.Name || `Period ${index + 1}`).trim();
  const isNight = original.toLowerCase().includes("night");
  const raw = p.startTime ?? p.StartTime ?? p.Date ?? "";
  const d = raw ? new Date(String(raw)) : null;
  if (!d || Number.isNaN(d.getTime())) return original;
  const tz = "Pacific/Honolulu";
  const ymd = (date: Date) =>
    new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: tz,
    }).format(date);
  if (ymd(d) === ymd(new Date())) return isNight ? "Tonight" : "Today";
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: tz }).format(d);
  return isNight ? `${weekday} Night` : weekday;
}

export function App() {
  const auth = useAuth();
  const defaultLoc = useMemo(
    () => BIG_ISLAND_LOCATIONS.find((l) => l.id === "volcano") ?? BIG_ISLAND_LOCATIONS[0]!,
    [],
  );
  const [location, setLocation] = useState<BigIslandLocation>(defaultLoc);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bundle, setBundle] = useState<Record<string, unknown> | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [detailModal, setDetailModal] = useState<
    null | { kind: "hvo"; h: Record<string, unknown> } | { kind: "quake"; q: Record<string, unknown> }
  >(null);
  const [intelReady, setIntelReady] = useState(false);

  const load = useCallback(
    async (refresh: boolean, attempt = 0) => {
      setLoading(true);
      if (attempt === 0) setError(null);
      try {
        const res = await apiFetch(dashboardPath(location, refresh), {
          headers: { Accept: "application/json" },
        });
        const text = await res.text();
        if (res.status === 401) {
          setBundle(null);
          await auth.logout();
          setError("Session expired. Sign in again.");
          return;
        }
        if (!res.ok) {
          if (attempt < 2 && res.status >= 502) {
            await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
            return load(refresh, attempt + 1);
          }
          setBundle(null);
          let detail = `${res.status} ${res.statusText}`;
          try {
            const err = JSON.parse(text) as { detail?: string };
            if (err.detail) detail = err.detail;
          } catch {
            if (text) detail = `${detail}\n${text.slice(0, 400)}`;
          }
          setError(detail);
          return;
        }
        const obj = JSON.parse(text) as Record<string, unknown>;
        setBundle(obj);
        setFetchedAt(new Date().toISOString());
        setError(null);
      } catch (e) {
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
          return load(refresh, attempt + 1);
        }
        setBundle(null);
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg === "Failed to fetch" ? "Could not reach the Kīlauea API. Check your connection and try Refresh." : msg);
      } finally {
        setLoading(false);
      }
    },
    [location, auth.logout],
  );

  useEffect(() => {
    if (!auth.decided || !auth.authed) return;
    void load(false);
  }, [auth.decided, auth.authed, load]);

  useEffect(() => {
    if (!auth.decided || !auth.authed) {
      setIntelReady(false);
      return;
    }
    if (bundle && !loading) {
      const t = window.setTimeout(() => setIntelReady(true), 400);
      return () => window.clearTimeout(t);
    }
    const fallback = window.setTimeout(() => setIntelReady(true), 3500);
    return () => window.clearTimeout(fallback);
  }, [auth.decided, auth.authed, bundle, loading]);

  useEffect(() => {
    if (!auth.decided || !auth.authed) return undefined;
    try {
      const key = `rr.app_session_notify.${RR_APP_ID}.acct`;
      if (typeof sessionStorage === "undefined" || !sessionStorage.getItem(key)) {
        if (typeof sessionStorage !== "undefined") sessionStorage.setItem(key, "1");
        void fetch(`${ACCOUNT_SESSION_API}/api/app-session/start`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getStoredToken() || ""}`,
          },
          body: JSON.stringify({ app_id: RR_APP_ID, mode: "signed_in" }),
          credentials: "include",
        }).catch(() => {});
      }
    } catch {
      /* session tracking should not block dashboard use */
    }
    const client = {
      post: async (path: string, body: Record<string, unknown>) => {
        const res = await apiFetch(`/api${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error("earn request failed");
        return { data: await res.json() };
      },
    };
    return startEarnUsageRewards(client, {
      appId: RR_APP_ID,
      getToken: () => getStoredToken() || "",
      getPage: () => (typeof window !== "undefined" ? window.location.pathname : "/"),
    });
  }, [auth.decided, auth.authed]);

  useEffect(() => {
    if (auth.decided && !auth.authed) {
      setBundle(null);
      setError(null);
      setFetchedAt(null);
    }
  }, [auth.decided, auth.authed]);

  useEffect(() => {
    setDetailModal(null);
  }, [location]);

  const view: DashboardView = useMemo(() => buildDashboardView(bundle), [bundle]);

  const alertsBlock = asRecord(bundle?.alerts);
  const caBlock = asRecord(bundle?.canada_alerts);
  const nwsList = Array.isArray(alertsBlock?.alerts) ? (alertsBlock!.alerts as unknown[]) : [];
  const caList = Array.isArray(caBlock?.alerts) ? (caBlock!.alerts as unknown[]) : [];
  const alertRows = [...nwsList, ...caList]
    .map((a) => asRecord(a))
    .filter(Boolean) as Record<string, unknown>[];

  const usgs = asRecord(bundle?.usgs);
  const quakes = Array.isArray(usgs?.events) ? (usgs!.events as unknown[]).slice(0, 4) : [];

  const forecastBlock = asRecord(bundle?.forecast);
  const periodsRaw = Array.isArray(forecastBlock?.periods) ? (forecastBlock!.periods as unknown[]) : [];
  const periods = periodsRaw.map((p) => asRecord(p)).filter(Boolean) as Record<string, unknown>[];
  const hourlyRaw = Array.isArray(forecastBlock?.hourly) ? (forecastBlock!.hourly as unknown[]) : [];
  const hourlySlots = hourlyRaw
    .map((h) => asRecord(h))
    .filter(Boolean)
    .slice(0, 14) as Record<string, unknown>[];

  const currentBlock = asRecord(bundle?.current);
  const attribution =
    (typeof currentBlock?.attribution === "string" && currentBlock.attribution.trim()) ||
    (typeof currentBlock?.source === "string" && currentBlock.source.trim()) ||
    null;

  if (!auth.decided) {
    return (
      <div className="app-root">
        <p className="muted" style={{ padding: "2rem 0", textAlign: "center" }}>
          Checking session…
        </p>
      </div>
    );
  }

  if (!auth.authed) {
    return <AuthScreen />;
  }

  // Web is Pro-only. Native (Capacitor Android) bypasses the paywall and runs free-with-restrictions.
  if (!IS_NATIVE && !isPro() && !isLifeMember()) {
    return <ProPaywall />;
  }

  return (
    <div className="app-root">
      <header className="site-header">
        <div className="site-header-inner">
          <div className="brand-block">
            <div className="brand-kicker">RootRecord</div>
            <h1 className="brand-title">Kīlauea observatory</h1>
            <p className="brand-sub">
              Hawaiʻi Island weather, alerts, and seismic activity — web dashboard using the same API bundle as the
              native app.
            </p>
          </div>
          <div className="toolbar">
            <label className="field">
              <span className="field-label">Location</span>
              <select
                className="select"
                value={location.id}
                onChange={(e) => {
                  const next = BIG_ISLAND_LOCATIONS.find((l) => l.id === e.target.value);
                  if (!next) return;
                  // Free-tier lock: only Volcano is allowed. Anything else triggers the upsell
                  // and the picker snaps back. (The server enforces the same lock if a client
                  // ever bypasses this guard, so the rewriting is purely UX-side.)
                  const free = !isPro() && !isLifeMember();
                  if (free && next.id !== FREE_TIER_LOC_ID) {
                    try { window.dispatchEvent(new Event(UPSELL_EVENT)); } catch { /* ignore */ }
                    return;
                  }
                  setLocation(next);
                }}
              >
                {BIG_ISLAND_LOCATIONS.map((l) => {
                  const free = !isPro() && !isLifeMember();
                  const locked = free && l.id !== FREE_TIER_LOC_ID;
                  return (
                    <option key={l.id} value={l.id}>
                      {l.label}{locked ? " — member" : ""}
                    </option>
                  );
                })}
              </select>
            </label>
            <div className="toolbar-user">
              <span className="muted small user-email" title={auth.email}>
                {auth.email}
              </span>
              <button type="button" className="btn btn-secondary" onClick={() => void auth.logout()}>
                Sign out
              </button>
            </div>
            <div className="toolbar-actions">
              <button type="button" className="btn btn-secondary" disabled={loading} onClick={() => void load(false)}>
                <span className={loading ? "spin" : ""} aria-hidden>
                  ↻
                </span>
                Refresh
              </button>
              <button type="button" className="btn btn-primary" disabled={loading} onClick={() => void load(true)}>
                Force cache bypass
              </button>
            </div>
            {fetchedAt ? <span className="muted small">Updated {fetchedAt}</span> : null}
          </div>
        </div>
      </header>

      {error ? (
        <div className="error-panel" role="alert">
          <span className="error-icon" aria-hidden>
            ⚠
          </span>
          <pre>{error}</pre>
        </div>
      ) : null}

      {bundle && !view.currentAvailable ? (
        <div className="warn-banner" role="status">
          <strong>Current conditions unavailable</strong>
          {view.currentReason ? (
            <span className="muted small">
              {" "}
              ({view.currentReason}
              {view.currentSource ? ` · ${view.currentSource}` : ""})
            </span>
          ) : null}
          <span className="muted small"> Forecast and alerts below may still load.</span>
        </div>
      ) : null}

      <DeveloperMessage />

      <VisitingHawaiiPromo />

      <div className="dashboard-layout">
        <div className="dashboard-main">
          <section className="panel panel-hero">
            <div className="panel-head">
              <span className="panel-icon" aria-hidden>
                ◎
              </span>
              <h2>Current conditions</h2>
              {attribution ? <span className="badge badge-soft">{attribution}</span> : null}
            </div>
            {loading && !bundle ? (
              <p className="muted">Loading conditions…</p>
            ) : (
              <>
                <div className="hero-metrics">
                  <div>
                    <div className="hero-temp">{view.heroTemp}</div>
                    {view.heroTempDetail ? <div className="hero-celsius muted small">{view.heroTempDetail}</div> : null}
                  </div>
                  <div className="hero-meta">
                    <div className="hero-phrase">{view.phrase}</div>
                    <div className="hero-sub muted small">
                      Feels like {view.feelsLikeShort}
                      {view.high !== "—" || view.low !== "—" ? (
                        <span className="hi-lo">
                          {" "}
                          · High {view.high} / Low {view.low}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="metric-strip">
                  <div className="metric-chip">
                    <span className="metric-chip-label">Wind</span>
                    <span className="metric-chip-value">{view.wind}</span>
                  </div>
                  <div className="metric-chip">
                    <span className="metric-chip-label">Humidity</span>
                    <span className="metric-chip-value">{view.humidity}</span>
                  </div>
                  <div className="metric-chip">
                    <span className="metric-chip-label">RealFeel®</span>
                    <span className="metric-chip-value">{view.realFeel}</span>
                  </div>
                </div>
                <div className="detail-bento">
                  <div className="bento-cell">
                    <span className="metric-chip-label">Dew point</span>
                    <span className="bento-value">{view.dew}</span>
                  </div>
                  <div className="bento-cell">
                    <span className="metric-chip-label">Pressure</span>
                    <span className="bento-value">{view.pressure}</span>
                  </div>
                  <div className="bento-cell">
                    <span className="metric-chip-label">UV index</span>
                    <span className="bento-value">{view.uv}</span>
                  </div>
                  <div className="bento-cell">
                    <span className="metric-chip-label">Cloud cover</span>
                    <span className="bento-value">{view.cloud}</span>
                  </div>
                  <div className="bento-cell bento-span">
                    <span className="metric-chip-label">Visibility</span>
                    <span className="bento-value">{view.visibility}</span>
                  </div>
                </div>
              </>
            )}
          </section>

          {hourlySlots.length > 0 ? (
            <section className="panel">
              <div className="panel-head">
                <span className="panel-icon" aria-hidden>
                  ⏱
                </span>
                <h2>Hourly</h2>
              </div>
              <div className="hourly-scroll" role="list">
                {hourlySlots.map((h, i) => {
                  const t = hourlyDisplayTemp(h);
                  const when = hourlySlotWhen(h);
                  const blurb = String(h.shortForecast || h.ShortPhrase || "").trim();
                  return (
                    <div key={i} className="hourly-cell" role="listitem">
                      <div className="hourly-time">{when}</div>
                      <div className="hourly-temp">{t}</div>
                      {blurb ? <div className="hourly-desc muted small">{blurb.length > 48 ? `${blurb.slice(0, 48)}…` : blurb}</div> : null}
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {periods.length > 0 ? (
            <section className="panel">
              <div className="panel-head">
                <span className="panel-icon" aria-hidden>
                  ☀
                </span>
                <h2>Forecast periods</h2>
              </div>
              <ul className="period-grid">
                {periods.slice(0, 10).map((p, i) => {
                  const name = periodLabel(p, i);
                  const sub = String(p.shortForecast || p.ShortPhrase || "").trim();
                  return (
                    <li key={i} className="period-card">
                      <div className="period-name">{name}</div>
                      <div className="period-temp">{periodTemp(p)}</div>
                      {sub ? <div className="period-desc muted small">{sub.length > 120 ? `${sub.slice(0, 120)}…` : sub}</div> : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
        </div>

        <aside className="dashboard-aside">
          <section
            className={`panel panel-hvo hvo-tone-${(() => {
              const hx = asRecord(bundle?.kilauea_hvo);
              if (hx?.available !== true) return "unknown";
              return String(hx.aviation_color_code ?? "unknown")
                .trim()
                .toLowerCase();
            })()}${
              asRecord(bundle?.kilauea_hvo)?.available === true ? " panel-hvo--interactive" : ""
            }`}
            aria-labelledby="hvo-heading"
            {...(() => {
              const h = asRecord(bundle?.kilauea_hvo);
              if (!h || h.available !== true) return {};
              return {
                role: "button" as const,
                tabIndex: 0,
                "aria-label": "Open full volcano notice in a dialog",
                onClick: () => setDetailModal({ kind: "hvo", h }),
                onKeyDown: (e: KeyboardEvent) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setDetailModal({ kind: "hvo", h });
                  }
                },
              };
            })()}
          >
            <div className="panel-head">
              <span className="panel-icon" aria-hidden>
                △
              </span>
              <h2 id="hvo-heading">USGS HVO — Kīlauea</h2>
            </div>
            {(() => {
              const h = asRecord(bundle?.kilauea_hvo);
              if (!h) {
                return <p className="muted small">Load the dashboard to see volcano status.</p>;
              }
              if (h.available !== true) {
                return (
                  <p className="muted small">
                    {String(h.reason || "").includes("outside")
                      ? "Volcano status is only included for Hawaiʻi Island views near Kīlauea."
                      : "Could not reach USGS HANS for the latest HVO notice."}
                  </p>
                );
              }
              const level = String(h.alert_level ?? "—").trim() || "—";
              const av = String(h.aviation_color_code ?? "—").trim() || "—";
              const title = typeof h.notice_title === "string" ? h.notice_title.trim() : "";
              const sent = typeof h.sent_utc === "string" ? h.sent_utc.trim() : "";
              const synopsis = typeof h.synopsis_plain === "string" ? h.synopsis_plain.trim() : "";
              return (
                <div className="hvo-body">
                  <div className="hvo-levels">
                    <div>
                      <div className="metric-chip-label">Alert level</div>
                      <div className="hvo-level">{level}</div>
                    </div>
                    <div>
                      <div className="metric-chip-label">Aviation color</div>
                      <div className="hvo-level">{av}</div>
                    </div>
                  </div>
                  {title ? <div className="hvo-title">{title}</div> : null}
                  {sent ? <div className="muted small">Notice date (UTC): {sent}</div> : null}
                  {synopsis ? <p className="hvo-synopsis muted small hvo-synopsis-preview">{synopsis}</p> : null}
                  <p className="muted small" style={{ marginTop: "0.5rem" }}>
                    Click the card for the full notice text.
                  </p>
                </div>
              );
            })()}
          </section>

          <section className="panel panel-alerts">
            <div className="panel-head">
              <span className="panel-icon" aria-hidden>
                !
              </span>
              <h2>Alerts</h2>
              <span className="badge">{alertRows.length}</span>
            </div>
            {alertRows.length === 0 ? (
              <p className="muted">No active alerts for this view.</p>
            ) : (
              <ul className="alert-list alert-list-scroll">
                {alertRows.map((a, i) => {
                  const head = alertTitle(a);
                  const sev = String(a.severity || "").toLowerCase();
                  return (
                    <li key={i} className={`alert-item sev-${sev || "unknown"}`}>
                      <div className="alert-title">{head}</div>
                      {a.description ? (
                        <div className="alert-desc muted small">
                          {String(a.description).length > 320
                            ? `${String(a.description).slice(0, 320)}…`
                            : String(a.description)}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="panel">
            <div className="panel-head">
              <span className="panel-icon" aria-hidden>
                〜
              </span>
              <h2>Recent earthquakes</h2>
            </div>
            {quakes.length === 0 ? (
              <p className="muted">No recent events in this bundle.</p>
            ) : (
              <ul className="quake-list">
                {quakes.map((q, i) => {
                  const row = asRecord(q);
                  if (!row) return null;
                  const mag = row.magnitude ?? row.mag;
                  const place = imperialPlace(row.place || row.title);
                  const when = usgsTimeLabel(row.time);
                  return (
                    <li
                      key={i}
                      className="quake-row quake-row--interactive"
                      role="button"
                      tabIndex={0}
                      aria-label={`Earthquake details: magnitude ${mag != null ? String(mag) : "unknown"} near ${place}`}
                      onClick={() => setDetailModal({ kind: "quake", q: row })}
                      onKeyDown={(e: KeyboardEvent) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setDetailModal({ kind: "quake", q: row });
                        }
                      }}
                    >
                      <span className="quake-mag">{mag != null ? String(mag) : "—"}</span>
                      <div className="quake-body">
                        <div className="quake-place">{place}</div>
                        <div className="muted small">{when}</div>
                        <div className="quake-row-hint">Tap for full details</div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </aside>
      </div>

      <section className="panel panel-links dashboard-resources">
        <div className="panel-head">
          <span className="panel-icon" aria-hidden>
            ↗
          </span>
          <h2>Resources</h2>
        </div>
        <div className="link-row link-row-full">
          <a className="link-pill" href="https://rootrecord.info/visiting-hawaii.html" target="_blank" rel="noreferrer" data-testid="resources-visiting-hawaii">
            Visiting Hawaiʻi (coming soon)
          </a>
          <a className="link-pill" href="https://rootrecord.info/charts/big-island-earthquakes/" target="_blank" rel="noreferrer">
            Public earthquake charts
          </a>
          <a className="link-pill" href="https://rootrecord.info/terms" target="_blank" rel="noreferrer">
            Terms
          </a>
          <a className="link-pill" href="https://rootrecord.info/privacy" target="_blank" rel="noreferrer">
            Privacy
          </a>
          <a className="link-pill" href="https://www.usgs.gov/volcanoes/kilauea" target="_blank" rel="noreferrer">
            USGS Kīlauea
          </a>
          <a className="link-pill" href="https://www.weather.gov/hfo/" target="_blank" rel="noreferrer">
            NWS Honolulu
          </a>
        </div>
      </section>

      <DashboardIntelSection ready={intelReady} />

      {detailModal?.kind === "hvo" ? (
        <DetailModal
          open
          title="USGS HVO — Kīlauea"
          onClose={() => setDetailModal(null)}
          footer={(() => {
            const u = typeof detailModal.h.notice_url === "string" ? detailModal.h.notice_url.trim() : "";
            if (!u) return undefined;
            return (
              <a className="link-pill modal-external" href={u} target="_blank" rel="noreferrer">
                Open official USGS page for this notice
              </a>
            );
          })()}
        >
          {(() => {
            const h = detailModal.h;
            const level = String(h.alert_level ?? "—").trim() || "—";
            const av = String(h.aviation_color_code ?? "—").trim() || "—";
            const title = typeof h.notice_title === "string" ? h.notice_title.trim() : "";
            const sent = typeof h.sent_utc === "string" ? h.sent_utc.trim() : "";
            const synopsis = typeof h.synopsis_plain === "string" ? h.synopsis_plain.trim() : "";
            return (
              <>
                <div className="modal-hvo-levels">
                  <div>
                    <div className="metric-chip-label">Alert level</div>
                    <div className="hvo-level">{level}</div>
                  </div>
                  <div>
                    <div className="metric-chip-label">Aviation color</div>
                    <div className="hvo-level">{av}</div>
                  </div>
                </div>
                {title ? <div className="hvo-title">{title}</div> : null}
                {sent ? <div className="muted small">Notice date (UTC): {sent}</div> : null}
                {synopsis ? (
                  <p className="modal-prose">{synopsis}</p>
                ) : (
                  <p className="muted small">No synopsis text was included in this update.</p>
                )}
              </>
            );
          })()}
        </DetailModal>
      ) : null}
      {detailModal?.kind === "quake" ? (
        <DetailModal
          open
          title="Earthquake details"
          onClose={() => setDetailModal(null)}
          footer={(() => {
            const u = typeof detailModal.q.url === "string" ? detailModal.q.url.trim() : "";
            if (!u) return undefined;
            return (
              <a className="link-pill modal-external" href={u} target="_blank" rel="noreferrer">
                Open this event on the USGS site
              </a>
            );
          })()}
        >
          <p className="modal-lead">{imperialPlace(detailModal.q.place || detailModal.q.title)}</p>
          <dl className="modal-dl">
            {quakeDetailRows(detailModal.q).flatMap((r) => [
              <dt key={`${r.label}-k`}>{r.label}</dt>,
              <dd key={`${r.label}-v`}>{r.value}</dd>,
            ])}
          </dl>
        </DetailModal>
      ) : null}
      <UpsellModal />
    </div>
  );
}
