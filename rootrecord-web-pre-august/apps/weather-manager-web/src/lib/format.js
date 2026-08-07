// Small formatting + unit helpers for the mobile UI.
import { useEffect, useState } from 'react';
import { safeLocalStorage } from './storage';

const STORAGE_UNITS_KEY = 'rrwm.units';
const UNITS_EVENT = 'rrwm.units.changed';

export function getUnits() {
  return safeLocalStorage.getItem(STORAGE_UNITS_KEY) === 'metric' ? 'metric' : 'imperial';
}
export function setUnits(u) {
  safeLocalStorage.setItem(STORAGE_UNITS_KEY, u === 'metric' ? 'metric' : 'imperial');
  try {
    // Same-tab updates don't reliably fire `storage`, so we emit our own.
    window.dispatchEvent(new Event(UNITS_EVENT));
  } catch {
    /* ignore */
  }
}

export function useUnits() {
  const [units, setUnitsState] = useState(getUnits());
  useEffect(() => {
    const on = () => setUnitsState(getUnits());
    window.addEventListener(UNITS_EVENT, on);
    window.addEventListener('storage', on);
    return () => {
      window.removeEventListener(UNITS_EVENT, on);
      window.removeEventListener('storage', on);
    };
  }, []);
  return units;
}

export function nwsScalarNumber(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (!t) return null;
    const m = t.match(/-?\d+(?:\.\d+)?/);
    if (!m) return null;
    const n = Number(m[0]);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof raw === 'object' && raw !== null) {
    if (Array.isArray(raw) || raw instanceof Date) return null;
    const v = raw.value ?? raw.Value;
    if (v !== undefined && v !== null && v !== '') {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * Format NWS grid hourly period air temperature for display.
 * Uses `hourly_grid_units` from the forecast bundle (`us` = Fahrenheit values, `si` = Celsius) when the period omits `temperatureUnit`.
 */
export function fmtHourlyGridTemp(period, hourlyGridUnits) {
  const n = nwsScalarNumber(period?.temperature);
  if (n === null) return '—';
  let letter = String(period?.temperatureUnit || '')
    .trim()
    .toUpperCase();
  if (letter !== 'C' && letter !== 'F') {
    letter = hourlyGridUnits === 'si' ? 'C' : 'F';
  }
  return fmtTemp(n, letter);
}

export function fmtTemp(value, fromUnit) {
  const n = nwsScalarNumber(value);
  if (n === null) return '—';
  const u = getUnits();
  const letter = String(fromUnit || '')
    .trim()
    .toUpperCase();
  let x = n;
  if (letter === 'C' && u === 'imperial') x = (n * 9) / 5 + 32;
  else if (letter === 'F' && u === 'metric') x = ((n - 32) * 5) / 9;
  return Math.round(x) + (u === 'imperial' ? '°F' : '°C');
}

export function fmtSpeedKmH(kmh) {
  if (kmh === null || kmh === undefined) return '—';
  const n = Number(kmh);
  if (!Number.isFinite(n)) return '—';
  const u = getUnits();
  if (u === 'imperial') return Math.round(n / 1.609) + ' mph';
  return Math.round(n) + ' km/h';
}

export function fmtMileOrKm(miles) {
  if (miles === null || miles === undefined) return '—';
  const n = Number(miles);
  if (!Number.isFinite(n)) return '—';
  const u = getUnits();
  if (u === 'imperial') return n.toFixed(0) + ' mi';
  return Math.round(n * 1.609) + ' km';
}

export function fmtKmOrMi(km, digits = 1) {
  if (km === null || km === undefined) return '—';
  const u = getUnits();
  const n = Number(km);
  if (!Number.isFinite(n)) return '—';
  if (u === 'imperial') return (n / 1.609).toFixed(digits) + ' mi';
  return n.toFixed(digits) + ' km';
}

export function fmtMmOrIn(mm, digits = 2) {
  if (mm === null || mm === undefined) return '—';
  const u = getUnits();
  const n = Number(mm);
  if (!Number.isFinite(n)) return '—';
  if (u === 'imperial') return (n / 25.4).toFixed(digits) + ' in';
  return n.toFixed(Math.max(0, Math.min(2, digits))) + ' mm';
}

export function fmtMOrFt(m, digits = 0) {
  if (m === null || m === undefined) return '—';
  const u = getUnits();
  const n = Number(m);
  if (!Number.isFinite(n)) return '—';
  if (u === 'imperial') return Math.round(n * 3.28084) + ' ft';
  return digits > 0 ? n.toFixed(digits) + ' m' : Math.round(n) + ' m';
}

export function timeAgo(timestampMs) {
  if (!timestampMs) return '—';
  const ms = Date.now() - Number(timestampMs);
  if (ms < 0) return 'soon';
  const m = Math.round(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.round(d / 30);
  return `${mo}mo ago`;
}

export function formatTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function severityClass(severity) {
  const s = String(severity || '').toLowerCase();
  if (s.includes('extreme')) return { bg: 'bg-sev-extreme/15', text: 'text-sev-extreme', border: 'border-sev-extreme/40' };
  if (s.includes('severe')) return { bg: 'bg-sev-severe/15', text: 'text-sev-severe', border: 'border-sev-severe/40' };
  if (s.includes('moderate')) return { bg: 'bg-sev-moderate/15', text: 'text-sev-moderate', border: 'border-sev-moderate/40' };
  return { bg: 'bg-sev-minor/15', text: 'text-sev-minor', border: 'border-sev-minor/40' };
}

export function magnitudeColor(mag) {
  const m = Number(mag) || 0;
  if (m >= 7) return { bg: 'bg-mag-critical', text: 'text-white' };
  if (m >= 5) return { bg: 'bg-mag-high', text: 'text-black' };
  if (m >= 3) return { bg: 'bg-mag-mid', text: 'text-black' };
  return { bg: 'bg-mag-low', text: 'text-black' };
}

export function clsx(...parts) {
  return parts.filter(Boolean).join(' ');
}

/**
 * Station / hourly "now" and grid `forecast.periods` highs are different NWS products;
 * the grid period high can sit below a fresh observation. Clamp so HIGH ≥ now and LOW ≤ now
 * when both exist (same temperature unit as `periodUnit`, default F).
 */
export function alignDailyHighLowWithNow(
  high,
  low,
  periodUnit,
  obsTempC,
  hourlyTemp,
  hourlyTempUnit
) {
  let cur = null;
  if (obsTempC != null && obsTempC !== undefined && Number.isFinite(Number(obsTempC))) {
    const c = Number(obsTempC);
    cur = periodUnit === 'C' ? c : (c * 9) / 5 + 32;
  } else if (
    hourlyTemp !== undefined &&
    hourlyTemp !== null &&
    hourlyTempUnit &&
    Number.isFinite(Number(hourlyTemp))
  ) {
    const t = Number(hourlyTemp);
    const hu = String(hourlyTempUnit)
      .trim()
      .toUpperCase();
    if (hu === 'C') {
      cur = periodUnit === 'C' ? t : (t * 9) / 5 + 32;
    } else {
      cur = periodUnit === 'C' ? ((t - 32) * 5) / 9 : t;
    }
  }
  if (cur == null || !Number.isFinite(cur)) {
    return { high, low };
  }
  let h = high;
  let l = low;
  if (high !== undefined && high !== null && Number.isFinite(Number(high))) {
    h = Math.max(Number(high), cur);
  }
  if (low !== undefined && low !== null && Number.isFinite(Number(low))) {
    l = Math.min(Number(low), cur);
  }
  return { high: h, low: l };
}

// NWS observations come in standard SI units; helper to convert and round
export function fromNwsValue(unit, n) {
  if (n === null || n === undefined) return null;
  // unit looks like 'wmoUnit:degC' / 'wmoUnit:km_h-1' / 'wmoUnit:Pa' / 'wmoUnit:percent'
  return Number(n);
}
