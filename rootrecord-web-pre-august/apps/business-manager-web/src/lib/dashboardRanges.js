import { addWeeks, startOfWeek, endOfWeek, setHours, setMinutes, setSeconds, setMilliseconds } from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import { startOfMonthISO, endOfMonthISO, startOfYearISO } from "./format";

/**
 * @param {string|undefined} tz Program `business_timezone` (`system` or IANA).
 * @returns {string|null} null → use device-local calendar math (same as `system`).
 */
export function resolveIanaTz(tz) {
  const t = String(tz || "").trim();
  if (!t || t === "system") return null;
  return t;
}

export function dashboardTimeZoneCaption(tz) {
  const iana = resolveIanaTz(tz);
  if (!iana) return "this device’s time zone";
  return iana.replace(/_/g, " ");
}

/**
 * @param {{ scope: string, year: number, monthIdx: number, weekOffset: number, businessTimezone?: string }} opts
 * @returns {[string, string|null]} [startISO, endISO] for `/dashboard/summary`. `end` is **null** for Today and
 * Yearly so the client omits `end` and the Worker uses **server time** on each request (avoids frozen/stale “now”).
 */
export function computeDashboardRange(opts) {
  const { scope, year, monthIdx, weekOffset = 0, businessTimezone } = opts;
  const now = new Date();
  const tz = resolveIanaTz(businessTimezone);

  if (scope === "year") {
    return [startOfYearISO(), null];
  }
  if (scope === "month") {
    return [startOfMonthISO(year, monthIdx), endOfMonthISO(year, monthIdx)];
  }
  if (scope === "today") {
    if (!tz) {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      return [d.toISOString(), null];
    }
    const dayStr = formatInTimeZone(now, tz, "yyyy-MM-dd");
    const start = fromZonedTime(`${dayStr} 00:00:00`, tz);
    return [start.toISOString(), null];
  }
  if (scope === "week") {
    const anchor = addWeeks(now, weekOffset);
    if (!tz) {
      let ws = startOfWeek(anchor, { weekStartsOn: 1 });
      ws = setHours(setMinutes(setSeconds(setMilliseconds(ws, 0), 0), 0), 0);
      let we = endOfWeek(anchor, { weekStartsOn: 1 });
      we = setHours(setMinutes(setSeconds(setMilliseconds(we, 999), 59), 59), 23);
      return [ws.toISOString(), we.toISOString()];
    }
    const z = toZonedTime(anchor, tz);
    let ws = startOfWeek(z, { weekStartsOn: 1 });
    ws = setHours(setMinutes(setSeconds(setMilliseconds(ws, 0), 0), 0), 0);
    let we = endOfWeek(z, { weekStartsOn: 1 });
    we = setHours(setMinutes(setSeconds(setMilliseconds(we, 999), 59), 59), 23);
    return [fromZonedTime(ws, tz).toISOString(), fromZonedTime(we, tz).toISOString()];
  }
  return [startOfYearISO(), null];
}

/** Hours from an active clock-in session that overlap [startIso, endIso] (UTC instants). Pass null `endIso` for “through now”. */
export function liveSessionHoursInRange(session, startIso, endIso) {
  if (!session?.started_at_utc) return 0;
  try {
    const s = new Date(session.started_at_utc).getTime();
    const a = new Date(startIso).getTime();
    const rangeEndMs = endIso == null || endIso === "" ? Date.now() : new Date(endIso).getTime();
    const now = Date.now();
    const to = Math.min(now, rangeEndMs);
    const from = Math.max(s, a);
    if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to) return 0;
    return (to - from) / 3_600_000;
  } catch {
    return 0;
  }
}

/** Short label for the week strip (uses business IANA when set, else device locale). */
export function formatWeekRangeLabel(startIso, endIso, businessTimezone) {
  try {
    if (endIso == null || endIso === "") return "";
    const tz = resolveIanaTz(businessTimezone);
    if (tz) {
      return `${formatInTimeZone(new Date(startIso), tz, "MMM d")} – ${formatInTimeZone(new Date(endIso), tz, "MMM d, yyyy")}`;
    }
    const a = new Date(startIso);
    const b = new Date(endIso);
    const o = { month: "short", day: "numeric" };
    return `${a.toLocaleDateString(undefined, o)} – ${b.toLocaleDateString(undefined, o)}`;
  } catch {
    return "";
  }
}
