// Tiny formatting helpers used everywhere.
export const cents = (n) => Number.isFinite(+n) ? +n : 0;

export function fmtMoney(amount_cents, currency = "USD") {
  const v = (cents(amount_cents) || 0) / 100;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(v);
  } catch {
    return `$${v.toFixed(2)}`;
  }
}

/** Compact currency for KPI cards (10k+ → K, 1M+ → M). Full value via `fmtMoney`. */
export function fmtMoneyCompact(amount_cents, currency = "USD") {
  const v = (cents(amount_cents) || 0) / 100;
  const abs = Math.abs(v);
  if (abs < 10_000) return fmtMoney(amount_cents, currency);

  const sign = v < 0 ? "-" : "";
  let body;
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000;
    body = m >= 10 ? `${Math.round(m)}M` : `${m.toFixed(1).replace(/\.0$/, "")}M`;
  } else {
    const k = abs / 1_000;
    body = k >= 100 ? `${Math.round(k)}K` : `${k.toFixed(1).replace(/\.0$/, "")}K`;
  }
  try {
    const sym =
      new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 })
        .formatToParts(0)
        .find((p) => p.type === "currency")?.value || "$";
    return `${sign}${sym}${body}`;
  } catch {
    return `${sign}$${body}`;
  }
}

export function fmtHours(h) {
  if (!Number.isFinite(+h)) return "0.00 h";
  return `${(+h).toFixed(2)} h`;
}

export function fmtDateShort(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export function fmtDateOnly(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString();
  } catch {
    return iso;
  }
}

export function fmtTimeOnly(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export function isoNow() {
  return new Date().toISOString();
}

export function startOfYearISO() {
  const d = new Date();
  d.setMonth(0, 1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function startOfMonthISO(year, monthIdx) {
  const d = new Date(year, monthIdx, 1, 0, 0, 0, 0);
  return d.toISOString();
}

export function endOfMonthISO(year, monthIdx) {
  const d = new Date(year, monthIdx + 1, 0, 23, 59, 59, 999);
  return d.toISOString();
}

/** Value for `<input type="datetime-local" />` in the user's local timezone. */
export function toDatetimeLocalInput(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
}

export function durationHours(startIso, endIso) {
  try {
    const s = new Date(startIso).getTime();
    const e = new Date(endIso).getTime();
    if (!Number.isFinite(s) || !Number.isFinite(e)) return 0;
    return Math.max(0, (e - s) / 3_600_000);
  } catch {
    return 0;
  }
}

export const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}
