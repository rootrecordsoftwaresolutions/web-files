import { ensureGuestId } from "../guest";
import { apiFetch } from "./api";

export type EarthquakeChartPayload = {
  ok: boolean;
  min_magnitude: number;
  days: number;
  count_description?: string;
  generated_at?: string;
  totals?: { in_window: number; fetched: number };
  activity?: {
    windows?: Record<string, { count: number; label: string; largest?: { magnitude: number; place: string } | null }>;
  };
  daily_counts?: Array<{ date: string; count: number; max_magnitude: number | null }>;
  magnitude_bins?: Array<{ label: string; count: number }>;
  events?: Array<{ time_ms: number; magnitude: number; place: string; time_iso?: string }>;
  detail?: string;
};

export type AiReportRow = {
  id: string;
  created_at: string;
  source_type: string;
  event: string | null;
  magnitude: number | null;
  headline: string | null;
  url: string | null;
  summary: string;
  body?: string;
};

export type AiReportsPayload = {
  ok?: boolean;
  reports: AiReportRow[];
  page?: number;
  limit?: number;
  total?: number;
  list_total?: number;
  total_pages?: number;
  has_prev?: boolean;
  has_next?: boolean;
};

function isJsonResponse(res: Response): boolean {
  const ct = res.headers.get("Content-Type") || "";
  return ct.includes("application/json");
}

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) {
    let detail = res.statusText || "Request failed";
    try {
      const err = JSON.parse(text) as { detail?: string; error?: string };
      if (err.detail) detail = err.detail;
      else if (err.error) detail = err.error;
    } catch {
      if (text) detail = text.slice(0, 200);
    }
    throw new Error(detail);
  }
  if (!text.trim()) throw new Error("Empty response from server");
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("Invalid JSON from server");
  }
}

/** Prefer same-origin Pages proxy; fall back to direct Worker API (local dev). */
async function fetchPublicKilauea(path: string): Promise<Response> {
  const p = path.startsWith("/") ? path : `/${path}`;
  const headers = new Headers({ Accept: "application/json", "X-Guest-Id": ensureGuestId() });

  if (typeof window !== "undefined") {
    try {
      const same = await fetch(p, { headers, credentials: "same-origin", cache: "no-store" });
      if (same.ok && isJsonResponse(same)) return same;
      if (same.status === 404 || (same.ok && !isJsonResponse(same))) {
        /* SPA shell or missing proxy — use Worker API */
      } else if (!same.ok && same.status < 502) {
        return same;
      }
    } catch {
      /* fall through to Worker API */
    }
  }

  return apiFetch(p, { headers: { Accept: "application/json" } });
}

/** Public chart API — same data as rootrecord.info/charts, no auth required. */
export async function fetchEarthquakeCharts(days: number): Promise<EarthquakeChartPayload> {
  const res = await fetchPublicKilauea(`/api/public/kilauea/big-island-earthquakes?days=${days}`);
  return parseJson(res);
}

export async function fetchLatestAiReport(): Promise<AiReportsPayload> {
  const res = await fetchPublicKilauea("/api/public/kilauea/ai-reports?limit=1&offset=0&full=1");
  return parseJson(res);
}

export async function fetchPreviousAiReport(): Promise<AiReportsPayload> {
  const res = await fetchPublicKilauea("/api/public/kilauea/ai-reports?limit=1&offset=1&full=1");
  return parseJson(res);
}

export function fmtReportUtc(iso: string | null | undefined): string {
  if (!iso) return "—";
  return iso.replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
}
