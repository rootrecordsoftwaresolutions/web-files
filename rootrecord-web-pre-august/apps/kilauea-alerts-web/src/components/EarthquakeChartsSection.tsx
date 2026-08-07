import { useEffect, useRef, useState } from "react";
import { fetchEarthquakeCharts, type EarthquakeChartPayload } from "../lib/kilaueaChartsApi";

const DAY_OPTIONS = [7, 30, 90] as const;

type ChartInstance = {
  destroy: () => void;
};

type ChartConstructor = new (ctx: CanvasRenderingContext2D | HTMLCanvasElement, config: unknown) => ChartInstance;

function getChart(): ChartConstructor | null {
  const w = window as unknown as { Chart?: ChartConstructor };
  return w.Chart ?? null;
}

export function EarthquakeChartsSection() {
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<EarthquakeChartPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const dailyRef = useRef<HTMLCanvasElement | null>(null);
  const binsRef = useRef<HTMLCanvasElement | null>(null);
  const scatterRef = useRef<HTMLCanvasElement | null>(null);
  const chartsRef = useRef<{ daily?: ChartInstance; bins?: ChartInstance; scatter?: ChartInstance }>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const payload = await fetchEarthquakeCharts(days);
        if (cancelled) return;
        if (!payload.ok) throw new Error(payload.detail || "Chart data unavailable");
        setData(payload);
      } catch (e) {
        if (!cancelled) {
          setData(null);
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [days]);

  useEffect(() => {
    Object.values(chartsRef.current).forEach((c) => c?.destroy());
    chartsRef.current = {};
    const Chart = getChart();
    if (!Chart || !data?.ok) return;

    const grid = "rgba(255,255,255,0.08)";
    const ticks = "rgba(232,244,239,0.55)";
    const accent = "rgba(94, 233, 176, 0.65)";
    const accentBorder = "#5ee9b0";

    const daily = data.daily_counts || [];
    if (dailyRef.current && daily.length) {
      chartsRef.current.daily = new Chart(dailyRef.current, {
        type: "bar",
        data: {
          labels: daily.map((d) => d.date.slice(5)),
          datasets: [{
            label: "Events",
            data: daily.map((d) => d.count),
            backgroundColor: accent,
            borderColor: accentBorder,
            borderWidth: 1,
          }],
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: ticks, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 }, grid: { color: grid } },
            y: { beginAtZero: true, ticks: { color: ticks, precision: 0 }, grid: { color: grid } },
          },
        },
      });
    }

    const bins = data.magnitude_bins || [];
    if (binsRef.current && bins.length) {
      chartsRef.current.bins = new Chart(binsRef.current, {
        type: "bar",
        data: {
          labels: bins.map((b) => b.label),
          datasets: [{
            data: bins.map((b) => b.count),
            backgroundColor: accent,
            borderColor: accentBorder,
            borderWidth: 1,
          }],
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: ticks }, grid: { display: false } },
            y: { beginAtZero: true, ticks: { color: ticks, precision: 0 }, grid: { color: grid } },
          },
        },
      });
    }

    const events = data.events || [];
    if (scatterRef.current && events.length) {
      chartsRef.current.scatter = new Chart(scatterRef.current, {
        type: "scatter",
        data: {
          datasets: [{
            label: "Magnitude",
            data: events.map((e) => ({ x: e.time_ms, y: e.magnitude })),
            backgroundColor: accent,
            borderColor: accentBorder,
            pointRadius: events.map((e) => Math.min(8, 2 + (e.magnitude || 0))),
          }],
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label(ctx: { dataIndex: number }) {
                  const e = events[ctx.dataIndex];
                  return e ? `M${e.magnitude} · ${e.place || "Hawaiʻi"}` : "";
                },
              },
            },
          },
          scales: {
            x: {
              type: "linear",
              ticks: {
                color: ticks,
                maxTicksLimit: 8,
                callback(v: string | number) {
                  const d = new Date(Number(v));
                  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
                },
              },
              grid: { color: grid },
            },
            y: {
              title: { display: true, text: "Magnitude", color: ticks },
              ticks: { color: ticks },
              grid: { color: grid },
            },
          },
        },
      });
    }

    return () => {
      Object.values(chartsRef.current).forEach((c) => c?.destroy());
      chartsRef.current = {};
    };
  }, [data]);

  const w = data?.activity?.windows;

  return (
    <section className="panel panel-charts" aria-labelledby="eq-charts-heading">
      <div className="panel-head panel-head-wrap">
        <div className="panel-head-main">
          <span className="panel-icon" aria-hidden>
            〜
          </span>
          <h2 id="eq-charts-heading">Big Island earthquakes (M1+)</h2>
        </div>
        <div className="chart-day-filters" role="group" aria-label="Chart time window">
          {DAY_OPTIONS.map((d) => (
            <button
              key={d}
              type="button"
              className={`chart-day-chip${days === d ? " is-on" : ""}`}
              onClick={() => setDays(d)}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {loading ? <p className="muted">Loading earthquake charts…</p> : null}
      {error ? <p className="muted" role="alert">{error}</p> : null}

      {data?.count_description ? <p className="muted small chart-count-desc">{data.count_description}</p> : null}

      {data?.ok ? (
        <>
          <div className="chart-stat-row">
            <div className="chart-stat">
              <span className="metric-chip-label">In window</span>
              <span className="chart-stat-v">{data.totals?.in_window ?? "—"}</span>
            </div>
            <div className="chart-stat">
              <span className="metric-chip-label">Last 24h</span>
              <span className="chart-stat-v">{w?.last_24_hours?.count ?? "—"}</span>
            </div>
            <div className="chart-stat">
              <span className="metric-chip-label">Last 7d</span>
              <span className="chart-stat-v">{w?.last_7_days?.count ?? "—"}</span>
            </div>
            <div className="chart-stat">
              <span className="metric-chip-label">Largest (7d)</span>
              <span className="chart-stat-v">
                {w?.last_7_days?.largest ? `M${w.last_7_days.largest.magnitude.toFixed(1)}` : "—"}
              </span>
            </div>
          </div>

          <div className="chart-grid">
            <div className="chart-card chart-card-wide">
              <h3 className="chart-card-title">Events per day (HST)</h3>
              <canvas ref={dailyRef} height={120} />
            </div>
            <div className="chart-card">
              <h3 className="chart-card-title">Magnitude distribution</h3>
              <canvas ref={binsRef} height={140} />
            </div>
            <div className="chart-card">
              <h3 className="chart-card-title">Magnitude over time</h3>
              <canvas ref={scatterRef} height={140} />
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
