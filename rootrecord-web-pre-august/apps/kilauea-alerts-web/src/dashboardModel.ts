/**
 * Normalizes `GET /api/dashboard` JSON (same bundle as the Kīlauea Android “Weather Manager” tab)
 * for web display. Server uses NWS-style quantized objects `{ value, unitCode }` and AccuWeather
 * mirrors that shape — the old web UI only read legacy `Temperature` / `Wind_Speed_Imperial` keys.
 */

export function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** NWS / AccuWeather “quantized” value or plain number. */
export function quantNumber(node: unknown): number | null {
  if (node == null) return null;
  if (typeof node === "number" && Number.isFinite(node)) return node;
  if (typeof node === "object" && node !== null && "value" in node) {
    const n = Number((node as { value: unknown }).value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function nestedPercent(node: unknown): number | null {
  const o = asRecord(node);
  if (!o) return quantNumber(node);
  return quantNumber(o);
}

export function cToF(c: number): number {
  return (c * 9) / 5 + 32;
}

export function fmtF(c: number | null): string {
  if (c == null || !Number.isFinite(c)) return "—";
  return `${Math.round(cToF(c))}°F`;
}

export function fmtDual(c: number | null): string {
  if (c == null || !Number.isFinite(c)) return "—";
  return `${Math.round(cToF(c))}°F (${Math.round(c)}°C)`;
}

export function fmtMphFromKmh(kmh: number | null): string {
  if (kmh == null || !Number.isFinite(kmh)) return "—";
  return `${Math.round(kmh * 0.621371)} mph`;
}

export function fmtKmh(kmh: number | null): string {
  if (kmh == null || !Number.isFinite(kmh)) return "—";
  return `${Math.round(kmh)} km/h`;
}

export function windSummary(obs: Record<string, unknown>, hourlyNow: Record<string, unknown>): string {
  const kmh = quantNumber(obs.windSpeed) ?? parseHourlyWindString(hourlyNow.windSpeed);
  const card =
    (typeof obs.windDirectionCardinal === "string" && obs.windDirectionCardinal.trim()) ||
    (typeof hourlyNow.windDirection === "string" && String(hourlyNow.windDirection).trim()) ||
    "";
  const spd = fmtMphFromKmh(kmh);
  if (spd === "—") return "—";
  return card ? `${card} ${spd}` : spd;
}

function parseHourlyWindString(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const text = String(raw).trim().toLowerCase();
  if (!text) return null;
  const nums = [...text.matchAll(/\d+(?:\.\d+)?/g)].map((m) => parseFloat(m[0]!));
  if (nums.length === 0) return null;
  const n = Math.max(...nums);
  if (text.includes("km/h") || text.includes("kmh")) return n;
  if (text.includes("knot") || /\bkt\b/.test(text)) return n * 1.852;
  if (text.includes("m/s") || text.includes("mps")) return n * 3.6;
  if (text.includes("mph")) return n * 1.60934;
  return n * 1.60934;
}

export function heroCelsius(obs: Record<string, unknown>, hourlyNow: Record<string, unknown>): number | null {
  const tObs = quantNumber(obs.temperature);
  if (tObs != null) return tObs;
  const raw = hourlyNow.temperature;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const unit = String(hourlyNow.temperatureUnit || "C").toUpperCase();
    if (unit === "F") return ((raw - 32) * 5) / 9;
    return raw;
  }
  return quantNumber(raw);
}

export function phrase(obs: Record<string, unknown>, hourlyNow: Record<string, unknown>): string {
  const a =
    (typeof hourlyNow.shortForecast === "string" && hourlyNow.shortForecast.trim()) ||
    (typeof hourlyNow.ShortPhrase === "string" && hourlyNow.ShortPhrase.trim()) ||
    (typeof obs.textDescription === "string" && obs.textDescription.trim()) ||
    (typeof obs.WeatherText === "string" && obs.WeatherText.trim()) ||
    "";
  return a || "—";
}

export function feelsLikeC(obs: Record<string, unknown>, hourlyNow: Record<string, unknown>): number | null {
  return quantNumber(obs.feelsLike) ?? quantNumber(hourlyNow.feelsLike);
}

export function humidityPct(obs: Record<string, unknown>, hourlyNow: Record<string, unknown>): string {
  const n = quantNumber(obs.relativeHumidity) ?? nestedPercent(hourlyNow.relativeHumidity);
  if (n == null || !Number.isFinite(n)) return "—";
  return `${Math.round(n)}%`;
}

export function dewPointLine(obs: Record<string, unknown>, hourlyNow: Record<string, unknown>): string {
  const c = quantNumber(obs.dewpoint) ?? quantNumber(hourlyNow.dewPoint);
  return fmtDual(c);
}

export function pressureHpa(obs: Record<string, unknown>): string {
  const pa = quantNumber(obs.barometricPressure);
  if (pa == null || !Number.isFinite(pa)) return "—";
  return `${Math.round(pa / 100)} hPa`;
}

export function uvLine(obs: Record<string, unknown>, hourlyNow: Record<string, unknown>): string {
  const raw = obs.uvIndex ?? hourlyNow.uvIndex;
  if (typeof raw === "number" && Number.isFinite(raw)) return String(Math.round(raw));
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  return "—";
}

export function cloudLine(obs: Record<string, unknown>, hourlyNow: Record<string, unknown>): string {
  const pct = quantNumber(obs.cloudCover) ?? parsePercentString(hourlyNow.cloudCover);
  if (pct == null) return "—";
  return `${Math.round(pct)}%`;
}

function parsePercentString(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  const m = raw.match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = parseFloat(m[1]!);
  return Number.isFinite(n) ? n : null;
}

export function visibilityLine(obs: Record<string, unknown>, hourlyNow: Record<string, unknown>): string {
  const m = quantNumber(obs.visibility);
  if (m != null && Number.isFinite(m)) {
    const km = m / 1000;
    const mi = km * 0.621371;
    return `${mi.toFixed(1)} mi (${km.toFixed(1)} km)`;
  }
  if (typeof hourlyNow.visibility === "string" && hourlyNow.visibility.trim()) return String(hourlyNow.visibility).trim();
  return "—";
}

export function dailyHighLow(periods: Record<string, unknown>[]): { high: string; low: string } {
  let highC: number | null = null;
  let lowC: number | null = null;
  for (const p of periods) {
    const day = p.isDaytime === true || p.isDaytime === "true";
    const t = Number(p.temperature);
    if (!Number.isFinite(t)) continue;
    const unit = String(p.temperatureUnit || "F").toUpperCase();
    const c = unit === "C" ? t : ((t - 32) * 5) / 9;
    if (day && highC == null) highC = c;
    if (!day && lowC == null) lowC = c;
    if (highC != null && lowC != null) break;
  }
  return { high: fmtF(highC), low: fmtF(lowC) };
}

export function usgsTimeLabel(time: unknown): string {
  if (time == null) return "—";
  const n = typeof time === "number" ? time : Number(time);
  if (!Number.isFinite(n)) return "—";
  const ms = n > 1e12 ? n : n * 1000;
  return new Date(ms).toLocaleString();
}

/** Key facts from a USGS GeoJSON-derived event object (see Worker `usgsEarthquakes`). */
export function quakeDetailRows(row: Record<string, unknown>): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string }> = [];
  const mag = row.magnitude ?? row.mag;
  if (mag != null && Number.isFinite(Number(mag))) rows.push({ label: "Magnitude", value: String(mag) });
  const place = String(row.place || row.title || "").trim();
  if (place) rows.push({ label: "Location", value: place });
  const when = usgsTimeLabel(row.time);
  if (when !== "—") rows.push({ label: "Time", value: when });
  const updated = usgsTimeLabel(row.updated);
  if (updated !== "—" && updated !== when) rows.push({ label: "Last updated", value: updated });
  const d = row.depth_km;
  if (typeof d === "number" && Number.isFinite(d)) {
    rows.push({ label: "Depth", value: `${Math.abs(d).toFixed(1)} km` });
  }
  const lat = row.lat;
  const lon = row.lon;
  if (typeof lat === "number" && typeof lon === "number" && Number.isFinite(lat) && Number.isFinite(lon)) {
    rows.push({ label: "Coordinates", value: `${lat.toFixed(3)}°, ${lon.toFixed(3)}°` });
  }
  const dist = row.distance_miles;
  if (typeof dist === "number" && Number.isFinite(dist)) {
    rows.push({ label: "Distance", value: `${dist.toFixed(0)} mi from this dashboard location` });
  }
  if (row.tsunami === true) {
    rows.push({ label: "Tsunami", value: "USGS flagged tsunami — follow official bulletins." });
  }
  const al = row.alert;
  if (typeof al === "string" && al.trim()) rows.push({ label: "USGS alert level", value: al.trim() });
  return rows;
}

export function alertTitle(a: Record<string, unknown>): string {
  return String(a.headline || a.event || a.title || "Alert").trim() || "Alert";
}

/** NWS `startTime` ISO, Accu `DateTime`, or epoch fields for hourly strip cells. */
export function formatSlotWhen(raw: unknown): string {
  if (raw == null) return "—";
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const d = new Date(raw > 1e12 ? raw : raw * 1000);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
  }
  const s = String(raw).trim();
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
}

/** Prefer `startTime`, then Accu `DateTime` / `EpochDateTime`, skipping unusable values. */
export function hourlySlotWhen(h: Record<string, unknown>): string {
  for (const key of ["startTime", "DateTime", "EpochDateTime"] as const) {
    const raw = h[key];
    if (raw == null || raw === "") continue;
    const s = formatSlotWhen(raw);
    if (s !== "—") return s;
  }
  return "—";
}

/** Hourly slot temperature: respect `temperatureUnit` before treating plain numbers as quantized °C. */
export function hourlyDisplayTemp(h: Record<string, unknown>): string {
  const raw = h.temperature;
  const unit = String(h.temperatureUnit || "").trim().toUpperCase();
  if (typeof raw === "number" && Number.isFinite(raw)) {
    if (unit === "C") return fmtF(raw);
    if (unit === "F") return `${Math.round(raw)}°F`;
  }
  const tQ = quantNumber(raw);
  if (tQ != null) return fmtF(tQ);
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const u = String(h.temperatureUnit || "F").toUpperCase();
    const c = u === "C" ? raw : ((raw - 32) * 5) / 9;
    return fmtF(c);
  }
  if (raw != null && raw !== "") {
    const u = String(h.temperatureUnit || "").trim();
    return u ? `${raw}°${u}` : `${raw}°`;
  }
  return "—";
}

export type DashboardView = {
  heroTemp: string;
  heroTempDetail: string;
  phrase: string;
  wind: string;
  humidity: string;
  /** Short “Feels like” line (°F only). */
  feelsLikeShort: string;
  /** RealFeel-style detail (°F and °C). */
  realFeel: string;
  dew: string;
  pressure: string;
  uv: string;
  cloud: string;
  visibility: string;
  high: string;
  low: string;
  currentAvailable: boolean;
  currentReason: string | null;
  currentSource: string | null;
};

export function buildDashboardView(bundle: Record<string, unknown> | null): DashboardView {
  if (!bundle) {
    return {
      heroTemp: "—",
      heroTempDetail: "",
      phrase: "—",
      wind: "—",
      humidity: "—",
      feelsLikeShort: "—",
      realFeel: "—",
      dew: "—",
      pressure: "—",
      uv: "—",
      cloud: "—",
      visibility: "—",
      high: "—",
      low: "—",
      currentAvailable: false,
      currentReason: null,
      currentSource: null,
    };
  }

  const current = asRecord(bundle.current) || {};
  const obs = asRecord(current.observation) || {};
  const hourlyNow = asRecord(current.hourly_now) || {};
  const curAvail = current.available !== false;
  const curReason = typeof current.reason === "string" ? current.reason : null;
  const curSource = typeof current.source === "string" ? current.source : null;

  const heroC = heroCelsius(obs, hourlyNow);
  const heroTemp = fmtF(heroC);
  const heroTempDetail = heroC != null ? `${Math.round(heroC)}°C` : "";
  const flC = feelsLikeC(obs, hourlyNow);

  const forecast = asRecord(bundle.forecast);
  const periodsRaw = Array.isArray(forecast?.periods) ? (forecast!.periods as unknown[]) : [];
  const periods = periodsRaw.map((p) => asRecord(p)).filter(Boolean) as Record<string, unknown>[];
  const { high, low } = dailyHighLow(periods);

  return {
    heroTemp,
    heroTempDetail,
    phrase: phrase(obs, hourlyNow),
    wind: windSummary(obs, hourlyNow),
    humidity: humidityPct(obs, hourlyNow),
    feelsLikeShort: fmtF(flC),
    realFeel: fmtDual(flC),
    dew: dewPointLine(obs, hourlyNow),
    pressure: pressureHpa(obs),
    uv: uvLine(obs, hourlyNow),
    cloud: cloudLine(obs, hourlyNow),
    visibility: visibilityLine(obs, hourlyNow),
    high,
    low,
    currentAvailable: curAvail,
    currentReason: curReason,
    currentSource: curSource,
  };
}
