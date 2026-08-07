import { json } from "./cors";
import {
  validateDevWorkstationAuth,
  type DevWorkstationEnv,
} from "./rootmc-dev-workstation";
import type { D1Database } from "@cloudflare/workers-types";

export type HostSiteEnv = DevWorkstationEnv & {
  ROOTMC_INTERNAL_API_KEY?: string;
};

const NWS_UA = "RootMC Hourly (api.rootmc.net; host-site)";
const DEFAULT_LAT = 19.5558;
const DEFAULT_LON = -155.1069;
/** Host-site D1 feed is pushed ~10m; treat older as offline for mining mult. */
const TELEMETRY_STALE_MS = 15 * 60_000;
/** EcoFlow sample age when Ava includes ecoUpdatedAt (matches Ava ECO_STALE_MS). */
const ECO_STALE_MS = 3 * 60_000;

function str(v: unknown): string {
  return String(v ?? "").trim();
}

/**
 * Solar bank SOC → gold mining multiplier during online hours.
 * multiplier = 1 + (batteryPercent / 100), clamp battery 0–100, max 3 decimals.
 * Offline / stale / no on-circuit bank / host device off → 1.0× (normal Gold).
 */
export function computeSolarMiningMultiplier(
  batteryPercent: number | null | undefined,
  online: boolean,
): number {
  if (!online || batteryPercent == null || !Number.isFinite(Number(batteryPercent))) {
    return 1;
  }
  const pct = Math.min(100, Math.max(0, Number(batteryPercent)));
  return Math.round((1 + pct / 100) * 1000) / 1000;
}

export type SolarMiningMultiplierSnapshot = {
  ok: true;
  battery_percent: number | null;
  multiplier: number;
  online: boolean;
  source: string;
  updated_at: string | null;
  detail?: string;
};

/**
 * Online hours = fresh host-site telemetry + live EcoFlow aggregate bank SOC
 * (on-circuit average already on the solar dashboard — not a sum of packs).
 * Host / device off, EcoFlow offline, off-circuit-only / stale / missing → 1.0× normal Gold.
 */
export function resolveSolarMiningMultiplier(
  telem: Record<string, unknown> | null,
): SolarMiningMultiplierSnapshot {
  const updatedAt =
    str(telem?._updated_at) ||
    str(telem?.updatedAt) ||
    null;
  const solar = (telem?.solar as Record<string, unknown>) || {};
  const batteryRaw = solar.batteryPct;
  const battery =
    batteryRaw != null && Number.isFinite(Number(batteryRaw))
      ? Number(batteryRaw)
      : null;

  let ageMs: number | null = null;
  if (updatedAt) {
    const t = Date.parse(updatedAt);
    if (Number.isFinite(t)) ageMs = Date.now() - t;
  }

  const ecoUpdatedAt = Number(solar.ecoUpdatedAt);
  let ecoAgeMs: number | null = null;
  if (Number.isFinite(ecoUpdatedAt) && ecoUpdatedAt > 0) {
    ecoAgeMs = Date.now() - ecoUpdatedAt;
  }

  const ecoStatus = str(solar.ecoStatus) || null;
  /** Explicit host PC / Root Server off (sleep or power-down) → normal Gold. */
  const hostOnline =
    telem?.hostOnline !== false &&
    solar.hostOnline !== false &&
    ecoStatus !== "host_off";
  const ecoOfflineFlag =
    solar.ecoOffline === true ||
    ecoStatus === "unconfigured" ||
    ecoStatus === "needs_sn" ||
    ecoStatus === "offline" ||
    ecoStatus === "host_off";
  const ecoStaleFlag =
    solar.ecoStale === true ||
    (ecoAgeMs != null && ecoAgeMs > ECO_STALE_MS);
  const telemStale = ageMs != null ? ageMs > TELEMETRY_STALE_MS : !telem;
  const hasBank = battery != null;

  let online =
    Boolean(telem) &&
    hostOnline &&
    !telemStale &&
    hasBank &&
    !ecoOfflineFlag &&
    !ecoStaleFlag;
  let detail = "live";
  if (!telem) {
    online = false;
    detail = "no_telemetry";
  } else if (!hostOnline) {
    online = false;
    detail = "host_device_off";
  } else if (telemStale) {
    online = false;
    detail = "telemetry_stale";
  } else if (ecoOfflineFlag) {
    online = false;
    detail = "ecoflow_offline";
  } else if (ecoStaleFlag) {
    online = false;
    detail = "ecoflow_stale";
  } else if (!hasBank) {
    online = false;
    detail = "no_on_circuit_bank";
  }

  const multiplier = computeSolarMiningMultiplier(battery, online);
  return {
    ok: true,
    battery_percent: hasBank ? battery : null,
    multiplier,
    online,
    source: "host-site-telemetry.solar.batteryPct",
    updated_at: updatedAt,
    detail,
  };
}

async function ensureTable(db: D1Database): Promise<void> {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS rootmc_host_site_telemetry (
         host_key TEXT PRIMARY KEY,
         payload_json TEXT NOT NULL,
         updated_at TEXT NOT NULL
       )`,
    )
    .run();
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS rootmc_ecoflow_samples (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         sn TEXT NOT NULL,
         label TEXT,
         live INTEGER NOT NULL DEFAULT 0,
         device_online INTEGER,
         soc REAL,
         solar_w REAL,
         in_w REAL,
         out_w REAL,
         sampled_at INTEGER NOT NULL,
         payload_json TEXT,
         created_at TEXT NOT NULL
       )`,
    )
    .run();
  await db
    .prepare(
      `CREATE INDEX IF NOT EXISTS idx_ecoflow_samples_sn_at
       ON rootmc_ecoflow_samples (sn, sampled_at DESC)`,
    )
    .run();
}

export async function readHostSiteTelemetry(
  db: D1Database,
  hostKey = "primary",
): Promise<Record<string, unknown> | null> {
  try {
    await ensureTable(db);
    const row = await db
      .prepare(
        `SELECT payload_json, updated_at FROM rootmc_host_site_telemetry WHERE host_key = ? LIMIT 1`,
      )
      .bind(hostKey)
      .first<{ payload_json: string; updated_at: string }>();
    if (!row?.payload_json) return null;
    const payload = JSON.parse(row.payload_json) as Record<string, unknown>;
    return { ...payload, _updated_at: row.updated_at };
  } catch {
    return null;
  }
}

async function nwsJson(url: string): Promise<any> {
  const res = await fetch(url, {
    headers: { Accept: "application/geo+json,application/json", "User-Agent": NWS_UA },
  });
  if (!res.ok) throw new Error(`nws ${res.status}`);
  return res.json();
}

/** Live NWS forecast + alerts for host-site coords (city/state never published). */
export async function fetchNwsHostWeather(lat = DEFAULT_LAT, lon = DEFAULT_LON) {
  const points = await nwsJson(
    `https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`,
  );
  const forecastUrl = points?.properties?.forecast as string | undefined;
  const city = null;
  const state = null;
  let period: any = null;
  if (forecastUrl) {
    const forecast = await nwsJson(forecastUrl);
    period = forecast?.properties?.periods?.[0] || null;
  }
  let alerts: Array<{ event: string; severity: string; headline: string }> = [];
  try {
    const alertData = await nwsJson(
      `https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`,
    );
    alerts = (alertData?.features || [])
      .map((f: any) => ({
        event: String(f?.properties?.event || "Alert"),
        severity: String(f?.properties?.severity || ""),
        headline: String(f?.properties?.headline || "").slice(0, 140),
      }))
      .slice(0, 5);
  } catch {
    alerts = [];
  }
  return {
    ok: true,
    source: "NWS",
    city,
    state,
    period: period
      ? {
          name: String(period.name || ""),
          temp: period.temperature,
          unit: String(period.temperatureUnit || "F"),
          wind: String(period.windSpeed || ""),
          short: String(period.shortForecast || ""),
        }
      : null,
    alerts,
  };
}

export async function buildHostSiteHourlySection(
  env: HostSiteEnv,
): Promise<{ content: string; detail: string }> {
  const telem = await readHostSiteTelemetry(env.DB, "primary");
  const site = (telem?.site as Record<string, unknown>) || {};
  const lat = Number(site.lat ?? DEFAULT_LAT);
  const lon = Number(site.lon ?? DEFAULT_LON);

  let weather: any = telem?.weather;
  try {
    // Prefer fresh NWS each hour (storm/hazard rail)
    weather = await fetchNwsHostWeather(lat, lon);
  } catch (e) {
    if (!weather?.ok) {
      weather = { ok: false, detail: e instanceof Error ? e.message : String(e) };
    }
  }

  const solar = (telem?.solar as Record<string, unknown>) || {};
  const perSn = (solar.perSn as Record<string, any>) || {};
  const solarLines: string[] = [];
  if (solar.batteryPct != null) {
    solarLines.push(`\u2022 **Bank:** ${solar.batteryPct}%`);
  }
  let solarTotal = 0;
  for (const [sn, v] of Object.entries(perSn)) {
    if (!v || typeof v !== "object" || !v.ok) continue;
    if (v.solarW != null) solarTotal += Number(v.solarW) || 0;
    const label = sn.slice(-6);
    const bits = [
      v.soc != null ? `SOC ${v.soc}%` : null,
      v.solarW != null ? `solar ${Math.round(Number(v.solarW))}W` : null,
    ].filter(Boolean);
    solarLines.push(`\u2022 **${label}:** ${bits.join(" / ")}`);
  }
  if (solarTotal > 0) {
    solarLines.push(`\u2022 **Site solar in:** ~${Math.round(solarTotal)}W`);
  }
  if (solar.morningAvgW != null) {
    solarLines.push(`\u2022 **Morning avg:** ~${Math.round(Number(solar.morningAvgW))}W`);
  }
  if (!solarLines.length) {
    solarLines.push(`\u2022 _Solar telemetry pending (Ava sync)_`);
  }

  const wxLines: string[] = [];
  if (weather?.period) {
    const p = weather.period;
    wxLines.push(
      `\u2022 **${p.name}:** ${p.temp}${p.unit} - ${p.short}` +
        (p.wind ? ` - wind ${p.wind}` : ""),
    );
  }
  wxLines.push(`\u2022 **Source:** ${weather?.source || "NWS"} (local point)`);
  if (Array.isArray(weather?.alerts) && weather.alerts.length) {
    for (const a of weather.alerts.slice(0, 4)) {
      wxLines.push(
        `\u2022 **HAZARD:** ${a.event}${a.severity ? ` (${a.severity})` : ""}`,
      );
    }
  } else {
    wxLines.push(`\u2022 **Hazards:** none active (NWS)`);
  }

  const siteLabel =
    str((site as Record<string, unknown>).label) ||
    "HI Pacific Solar Root Server";
  const content = [
    `**Host site** - ${siteLabel}`,
    `**Solar / EcoFlow**`,
    ...solarLines,
    `**Local weather**`,
    ...wxLines,
  ].join("\n");

  return {
    content,
    detail: `host-site solar=${solarLines.length} wx=${weather?.ok ? "ok" : "fail"} alerts=${weather?.alerts?.length || 0}`,
  };
}

export async function handleHostSiteRoutes(
  req: Request,
  env: HostSiteEnv,
  subpath: string,
): Promise<Response | null> {
  // Public live mining multiplier (Gold G) from aggregate bank SOC.
  if (
    req.method === "GET" &&
    (subpath === "/rootmc/solar-mining-multiplier" ||
      subpath === "/rootmc/solar-mining-multiplier/")
  ) {
    const telem = await readHostSiteTelemetry(env.DB);
    return json(resolveSolarMiningMultiplier(telem));
  }

  if (!subpath.startsWith("/rootmc/host-site")) return null;
  const rest = subpath.slice("/rootmc/host-site".length) || "/";

  if (req.method === "GET" && (rest === "/telemetry" || rest === "/")) {
    const telem = await readHostSiteTelemetry(env.DB);
    const mining = resolveSolarMiningMultiplier(telem);
    return json({ ok: true, telemetry: telem, mining });
  }

  if (req.method === "GET" && (rest === "/ecoflow/samples" || rest === "/ecoflow/samples/")) {
    await ensureTable(env.DB);
    const url = new URL(req.url);
    const sn = str(url.searchParams.get("sn"));
    const limit = Math.min(2000, Math.max(1, Number(url.searchParams.get("limit") || 60)));
    const since = Number(url.searchParams.get("since") || 0);
    const sinceMs = Number.isFinite(since) && since > 0 ? since : 0;
    const rows = sn
      ? sinceMs
        ? await env.DB.prepare(
            `SELECT sn, label, live, device_online, soc, solar_w, in_w, out_w, sampled_at, created_at
             FROM rootmc_ecoflow_samples
             WHERE sn = ? AND sampled_at >= ?
             ORDER BY sampled_at DESC LIMIT ?`,
          )
            .bind(sn, sinceMs, limit)
            .all()
        : await env.DB.prepare(
            `SELECT sn, label, live, device_online, soc, solar_w, in_w, out_w, sampled_at, created_at
             FROM rootmc_ecoflow_samples WHERE sn = ? ORDER BY sampled_at DESC LIMIT ?`,
          )
            .bind(sn, limit)
            .all()
      : sinceMs
        ? await env.DB.prepare(
            `SELECT sn, label, live, device_online, soc, solar_w, in_w, out_w, sampled_at, created_at
             FROM rootmc_ecoflow_samples
             WHERE sampled_at >= ?
             ORDER BY sampled_at DESC LIMIT ?`,
          )
            .bind(sinceMs, limit)
            .all()
        : await env.DB.prepare(
            `SELECT sn, label, live, device_online, soc, solar_w, in_w, out_w, sampled_at, created_at
             FROM rootmc_ecoflow_samples ORDER BY sampled_at DESC LIMIT ?`,
          )
            .bind(limit)
            .all();
    return json({ ok: true, samples: rows?.results || [], since: sinceMs || null });
  }

  if (req.method === "POST" && rest === "/telemetry") {
    if (!validateDevWorkstationAuth(req, env)) {
      return json({ ok: false, detail: "unauthorized" }, 401);
    }
    let body: any;
    try {
      body = await req.json();
    } catch {
      return json({ ok: false, detail: "invalid_json" }, 400);
    }
    await ensureTable(env.DB);
    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO rootmc_host_site_telemetry (host_key, payload_json, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(host_key) DO UPDATE SET
         payload_json = excluded.payload_json,
         updated_at = excluded.updated_at`,
    )
      .bind("primary", JSON.stringify(body), now)
      .run();

    // Persist per-SN EcoFlow samples for fresh history (Alex 2026-08-03)
    const inserted = await insertEcoflowSamplesFromTelemetry(env.DB, body, now);
    return json({ ok: true, updated_at: now, eco_samples_inserted: inserted });
  }

  if (req.method === "POST" && (rest === "/ecoflow/samples" || rest === "/ecoflow/samples/")) {
    if (!validateDevWorkstationAuth(req, env)) {
      return json({ ok: false, detail: "unauthorized" }, 401);
    }
    let body: any;
    try {
      body = await req.json();
    } catch {
      return json({ ok: false, detail: "invalid_json" }, 400);
    }
    await ensureTable(env.DB);
    const now = new Date().toISOString();
    const samples = Array.isArray(body?.samples) ? body.samples : [body];
    let n = 0;
    for (const s of samples) {
      if (!s?.sn) continue;
      await env.DB.prepare(
        `INSERT INTO rootmc_ecoflow_samples
         (sn, label, live, device_online, soc, solar_w, in_w, out_w, sampled_at, payload_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          str(s.sn),
          str(s.label) || null,
          s.live === true || s.live === 1 ? 1 : 0,
          s.deviceOnline === false || s.device_online === 0
            ? 0
            : s.deviceOnline === true || s.device_online === 1
              ? 1
              : null,
          s.soc != null ? Number(s.soc) : null,
          s.solarW != null ? Number(s.solarW) : s.solar_w != null ? Number(s.solar_w) : null,
          s.inW != null ? Number(s.inW) : s.in_w != null ? Number(s.in_w) : null,
          s.outW != null ? Number(s.outW) : s.out_w != null ? Number(s.out_w) : null,
          Number(s.sampledAt || s.sampled_at || Date.now()),
          JSON.stringify(s),
          now,
        )
        .run();
      n += 1;
    }
    return json({ ok: true, inserted: n, created_at: now });
  }

  return null;
}

async function insertEcoflowSamplesFromTelemetry(
  db: D1Database,
  body: any,
  createdAt: string,
): Promise<number> {
  const solar = body?.solar || {};
  const perSn = (solar.perSn || body?.perSn || {}) as Record<string, any>;
  const labels: Record<string, string> = {
    R331ZAB5SG6S2858: "Delta 2",
    R621ZA16XH6K1155: "River 2 Pro",
  };
  let n = 0;
  for (const [sn, v] of Object.entries(perSn)) {
    if (!sn || !v) continue;
    const live = v.ok === true && v.live !== false && v.deviceOnline !== false;
    const known = live
      ? v
      : v.lastKnown && typeof v.lastKnown === "object"
        ? v.lastKnown
        : v;
    await db
      .prepare(
        `INSERT INTO rootmc_ecoflow_samples
         (sn, label, live, device_online, soc, solar_w, in_w, out_w, sampled_at, payload_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        sn,
        labels[sn] || sn.slice(-6),
        live ? 1 : 0,
        v.deviceOnline === false ? 0 : v.deviceOnline === true ? 1 : null,
        known?.soc != null ? Number(known.soc) : null,
        known?.solarW != null ? Number(known.solarW) : null,
        known?.inW != null ? Number(known.inW) : null,
        known?.outW != null ? Number(known.outW) : null,
        Number(v.sampledAt || Date.now()),
        JSON.stringify({ sn, ...v }),
        createdAt,
      )
      .run();
    n += 1;
  }
  return n;
}
