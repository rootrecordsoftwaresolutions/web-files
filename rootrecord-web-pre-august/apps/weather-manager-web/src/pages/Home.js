import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  MapPin,
  RefreshCw,
  Plus,
  Wind,
  Droplets,
  Gauge,
  Sun,
  AlertTriangle,
  ArrowUpRight,
  Loader2,
  Sparkles,
  Thermometer,
  Cloud,
  Layers,
  Umbrella,
} from 'lucide-react';
import { api, getCachedLocations } from '../lib/api';
import {
  fmtTemp,
  fmtHourlyGridTemp,
  fmtSpeedKmH,
  fmtMileOrKm,
  fmtKmOrMi,
  fmtMmOrIn,
  fmtMOrFt,
  severityClass,
  formatTime,
  clsx,
  alignDailyHighLowWithNow,
  useUnits,
  nwsScalarNumber,
} from '../lib/format';
import AccuWeatherIcon from '../components/AccuWeatherIcon';
import { safeLocalStorage } from '../lib/storage';
import { alertDescriptionForDisplay } from '../lib/alertText';
import useAccess from '../lib/useAccess';
import { forecastDayLimit, FORECAST_DAYS_PRO, showUpsellModal } from '../lib/tierAccess';

/** Skip `/api/dashboard` while a snapshot for this location is younger than this (matches server TTL). */
const WEATHER_SNAPSHOT_MAX_AGE_MS = 15 * 60 * 1000;

/** NWS / Accu payloads sometimes nest strings as objects; React throws if we render a non-primitive. */
function safeText(v, fallback = '—') {
  if (v == null) return fallback;
  if (typeof v === 'string') return v.trim() || fallback;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return fallback;
}

function weatherSnapshotKey(locationId) {
  return `rrwm.weatherSnap.v1.${locationId}`;
}

function readWeatherSnapshot(locationId) {
  if (!locationId) return null;
  try {
    const raw = safeLocalStorage.getItem(weatherSnapshotKey(locationId));
    if (!raw) return null;
    const row = JSON.parse(raw);
    const bundle = row?.bundle;
    if (!bundle || typeof bundle !== 'object') return null;
    const iso = bundle.fetched_at || row.savedAt; // Worker may omit fetched_at; use last save time
    if (!iso || typeof iso !== 'string') return null;
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return null;
    const age = Date.now() - t;
    if (age < 0 || age > WEATHER_SNAPSHOT_MAX_AGE_MS) return null;
    return bundle;
  } catch {
    return null;
  }
}

function writeWeatherSnapshot(locationId, bundle) {
  if (!locationId || !bundle) return;
  try {
    safeLocalStorage.setItem(
      weatherSnapshotKey(locationId),
      JSON.stringify({ bundle, savedAt: new Date().toISOString() })
    );
  } catch {
    /* quota / private mode */
  }
}

function Bento({ icon: Icon, label, value, sub }) {
  return (
    <div
      className="bg-container border border-subtle p-3 flex flex-col items-center text-center gap-1 min-h-[5.5rem] justify-center"
      data-testid={`bento-${label.toLowerCase()}`}
    >
      <Icon strokeWidth={1.5} className="w-4 h-4 text-accent shrink-0" aria-hidden />
      <span className="text-[10px] uppercase tracking-widest font-mono text-accent/80">{label}</span>
      <div className="font-mono text-2xl tracking-tight text-white">{value ?? '—'}</div>
      {sub && <div className="text-xs text-accent/70 font-mono">{sub}</div>}
    </div>
  );
}

function usgsEventDetailUrl(e) {
  if (e?.url && /^https?:\/\//i.test(String(e.url))) return e.url;
  const raw = e?.id;
  if (!raw) return null;
  const slug = String(raw).split('/').pop();
  if (!slug) return null;
  return `https://earthquake.usgs.gov/earthquakes/eventpage/${encodeURIComponent(slug)}`;
}

/** `provider` is set by the Worker; infer from bundle for older cached payloads. */
function alertProviderLabel(a, bundle) {
  let p = String(a?.provider || '').toLowerCase();
  if (!p) {
    const src = String(bundle?.alerts?.source || '').toLowerCase();
    if (src === 'accuweather') p = 'accuweather';
    else if (src === 'noaa') p = 'noaa';
  }
  if (p === 'accuweather') return 'Weather';
  if (p === 'canada') return 'Environment Canada';
  if (p === 'noaa') return 'NOAA';
  return 'Weather';
}

function alertSeverityLabel(a) {
  const s = a?.severity;
  if (s != null && s !== '' && Number.isFinite(Number(s))) return 'Alert';
  const t = safeText(s, '');
  return t || 'Info';
}

function alertPreviewText(a) {
  const desc = alertDescriptionForDisplay(a).replace(/\s+/g, ' ').trim();
  const hl =
    typeof a?.headline === 'string'
      ? a.headline.replace(/\s+/g, ' ').trim()
      : '';
  const ev = typeof a?.event === 'string' ? a.event.trim() : '';
  let body = desc || hl;
  if (ev && body.toLowerCase().startsWith(ev.toLowerCase().slice(0, Math.min(24, ev.length)))) {
    body = desc.length > ev.length ? desc : hl;
  }
  if (!body) return '—';
  return body.length > 220 ? `${body.slice(0, 220)}…` : body;
}

function LocationPicker({ locations, activeId, onPick }) {
  const [open, setOpen] = useState(false);
  const active = locations.find((l) => l.id === activeId) || locations[0];
  if (!active) return null;
  return (
    <div className="relative" data-testid="location-picker">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 active:scale-95"
        data-testid="location-picker-button"
      >
        <MapPin strokeWidth={1.5} className="w-4 h-4 text-accent" />
        <span className="text-base font-medium">{active.name}</span>
        <ChevronDown strokeWidth={1.5} className="w-4 h-4 text-accent/80" />
      </button>
      {open && (
        <div className="absolute left-0 mt-2 w-56 bg-container border border-subtle z-20 animate-fadein" data-testid="location-picker-list">
          {locations.map((l) => (
            <button
              key={l.id}
              data-testid={`location-option-${l.id}`}
              onClick={() => { onPick(l.id); setOpen(false); }}
              className={clsx(
                'flex items-center justify-between w-full text-left px-3 py-3 border-b border-subtle last:border-0 hover:bg-containerHover',
                l.id === active.id && 'text-accent'
              )}
            >
              <span>{l.name}</span>
              <span className="text-[10px] font-mono text-accent/70">
                {Number.isFinite(Number(l.latitude)) && Number.isFinite(Number(l.longitude))
                  ? `${Number(l.latitude).toFixed(2)},${Number(l.longitude).toFixed(2)}`
                  : '—'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function formatAiTimestamp(raw) {
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function WeatherAiCard({ paid, aiData, loading, refreshing, error, onRefresh }) {
  const reports = Array.isArray(aiData?.reports) ? aiData.reports : [];
  const latest = aiData?.report || reports[0] || null;
  const quota = aiData?.quota || {};
  const remaining = Number(quota.remaining_today);
  const limit = Number(quota.limit_per_location) || 2;
  const remainingLabel = Number.isFinite(remaining)
    ? `${Math.max(0, remaining)} of ${limit} refreshes left today`
    : `2 refreshes per location daily`;

  if (!paid) {
    return (
      <div className="bg-container border border-subtle p-4 mb-4" data-testid="home-weather-ai-card">
        <div className="flex items-start gap-3">
          <Sparkles strokeWidth={1.5} className="w-5 h-5 text-accent shrink-0 mt-0.5" aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-mono uppercase tracking-widest text-accent/70 mb-1">Weather AI</div>
            <h2 className="text-base font-medium text-white">Member location report</h2>
            <p className="text-sm text-accent/75 mt-1">
              Pro and Lifetime members can generate AI reports from their saved weather data.
            </p>
            <button
              type="button"
              onClick={() => showUpsellModal()}
              className="mt-3 text-xs font-mono text-accent hover:text-accentHover"
              data-testid="home-weather-ai-upsell"
            >
              See member plans →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-container border border-subtle p-4 mb-4" data-testid="home-weather-ai-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-mono uppercase tracking-widest text-accent/70 mb-1 flex items-center gap-2">
            <Sparkles strokeWidth={1.5} className="w-3.5 h-3.5" aria-hidden /> Weather AI
          </div>
          <h2 className="text-base font-medium text-white">Member location report</h2>
          <p className="text-xs text-accent/70 mt-1">{remainingLabel}</p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing || loading || remaining === 0}
          className={clsx(
            'px-3 py-2 border border-subtle text-xs font-mono text-neutral-200 hover:bg-containerHover active:scale-95',
            (refreshing || loading) && 'opacity-70',
            remaining === 0 && 'opacity-50 cursor-not-allowed'
          )}
          data-testid="home-weather-ai-refresh"
        >
          {refreshing ? 'Generating…' : latest ? 'Refresh AI' : 'Generate'}
        </button>
      </div>

      {loading && !latest ? (
        <div className="flex items-center gap-2 text-sm text-accent/70 mt-4">
          <Loader2 strokeWidth={1.5} className="w-4 h-4 animate-spin" aria-hidden />
          Loading AI report…
        </div>
      ) : latest ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-neutral-100 leading-relaxed">{latest.summary_text}</p>
          <div className="border-t border-subtle pt-3">
            <div className="text-[10px] font-mono uppercase tracking-widest text-accent/70 mb-1">Report</div>
            <p className="text-sm text-neutral-200 leading-relaxed whitespace-pre-wrap">{latest.report_text}</p>
          </div>
          <div className="text-[10px] font-mono text-accent/60">
            Source weather: {formatAiTimestamp(latest.weather_fetched_at) || 'cached data'} · Report: {formatAiTimestamp(latest.created_at) || 'recent'}
          </div>
        </div>
      ) : (
        <p className="text-sm text-accent/75 mt-4">
          Generate a report from the latest saved dashboard data for this location.
        </p>
      )}

      {error && (
        <div className="text-xs bg-sev-severe/10 border border-sev-severe/40 text-sev-severe p-2 mt-3" data-testid="home-weather-ai-error">
          {error}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  // Forces rerender when units change (Settings toggle).
  useUnits();
  const { pro, life } = useAccess();
  const maxForecastDays = forecastDayLimit();
  const [locations, setLocations] = useState([]);
  const [activeId, setActiveId] = useState(safeLocalStorage.getItem('rrwm.activeLocationId') || '');
  const [bundle, setBundle] = useState(null);
  /** Which location id `bundle` was loaded for (avoids empty UI gap before first dashboard response). */
  const [bundleLocId, setBundleLocId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState('');
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [aiData, setAiData] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiRefreshing, setAiRefreshing] = useState(false);
  const [aiError, setAiError] = useState('');

  const loadLocations = useCallback(async () => {
    setLocationsLoading(true);
    try {
      const { data } = await api.listLocations();
      const rows = data || [];
      setLocations(rows);
      setActiveId((prev) => {
        if (rows.length && !rows.find((d) => d.id === prev)) {
          const next = rows[0].id;
          safeLocalStorage.setItem('rrwm.activeLocationId', next);
          return next;
        }
        return prev;
      });
      setErr('');
    } catch (e) {
      const cached = getCachedLocations();
      if (cached.length) {
        setLocations(cached);
        setActiveId((prev) => {
          if (!cached.find((d) => d.id === prev)) {
            const next = cached[0].id;
            safeLocalStorage.setItem('rrwm.activeLocationId', next);
            return next;
          }
          return prev;
        });
        setErr('Could not sync latest locations. Showing saved device copy.');
      } else {
        setErr(String(e?.response?.data?.detail || e?.message || 'Failed to load locations'));
      }
    } finally {
      setLocationsLoading(false);
    }
  }, []);

  const loadBundle = useCallback(async (loc, opts = {}) => {
    if (!loc) return;
    const force = Boolean(opts.forceRefresh);
    if (!force) {
      const cached = readWeatherSnapshot(loc.id);
      if (cached) {
        setBundle(cached);
        setBundleLocId(loc.id);
        setErr('');
        setRefreshing(false);
        return;
      }
    }
    setErr('');
    try {
      const { data } = await api.dashboard(loc.latitude, loc.longitude, {
        forceRefresh: force,
        locationId: loc.id,
      });
      setBundle(data);
      setBundleLocId(loc.id);
      writeWeatherSnapshot(loc.id, data);
      // Free users who burned their 2/day external fetch budget see this flag from the
      // Worker. Surface the upsell when they actively attempt a refresh (`force === true`)
      // so we don't spam the modal on every silent auto-load.
      if (force && data && data.free_daily_limit_reached) {
        try { window.dispatchEvent(new Event('rr.upsell.show')); } catch { /* ignore */ }
      }
    } catch (e) {
      setErr(String(e?.response?.data?.detail || e?.message || 'Failed to load weather'));
      setBundleLocId(loc.id);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // Hydrate from local cache immediately to avoid showing "Add location" between cold start and API response.
    const cached = getCachedLocations();
    if (cached.length) {
      setLocations(cached);
      setActiveId((prev) => {
        if (!cached.find((d) => d.id === prev)) {
          const next = cached[0].id;
          safeLocalStorage.setItem('rrwm.activeLocationId', next);
          return next;
        }
        return prev;
      });
    }
    loadLocations();
  }, [loadLocations]);

  useEffect(() => {
    const loc = locations.find((l) => l.id === activeId) || locations[0];
    if (loc) loadBundle(loc);
  }, [activeId, locations, loadBundle]);

  const handleRefresh = async () => {
    const loc = locations.find((l) => l.id === activeId);
    if (!loc) return;
    setRefreshing(true);
    await loadBundle(loc, { forceRefresh: true });
  };

  const setActive = (id) => {
    setActiveId(id);
    safeLocalStorage.setItem('rrwm.activeLocationId', id);
  };

  const activeLoc = locations.find((l) => l.id === activeId) || locations[0];
  const paid = pro || life;

  const loadLocationAi = useCallback(async (loc, opts = {}) => {
    if (!loc || !paid) {
      setAiData(null);
      setAiError('');
      return;
    }
    if (!opts.silent) setAiLoading(true);
    setAiError('');
    try {
      const { data } = await api.getLocationAi(loc.id);
      setAiData(data);
    } catch (e) {
      setAiError(String(e?.response?.data?.detail || e?.message || 'Failed to load Weather AI'));
    } finally {
      if (!opts.silent) setAiLoading(false);
    }
  }, [paid]);

  useEffect(() => {
    loadLocationAi(activeLoc);
  }, [activeLoc?.id, loadLocationAi]);

  const handleAiRefresh = async () => {
    if (!paid) {
      showUpsellModal();
      return;
    }
    if (!activeLoc) return;
    setAiRefreshing(true);
    setAiError('');
    try {
      const { data } = await api.refreshLocationAi(activeLoc.id);
      setAiData(data);
    } catch (e) {
      if (e?.response?.data?.reports || e?.response?.data?.quota) {
        setAiData(e.response.data);
      }
      const detail = e?.response?.data?.detail;
      if (detail === 'weather_data_required') {
        setAiError('Refresh weather for this location first, then generate the AI report.');
      } else if (e?.response?.status === 429) {
        setAiError('Daily AI refresh limit reached for this location.');
      } else {
        setAiError(String(detail || e?.message || 'Failed to generate Weather AI'));
      }
    } finally {
      setAiRefreshing(false);
    }
  };

  /** Full skeleton until dashboard matches active location (covers first location + picker changes; not plain refresh). */
  const showWeatherSkeleton = Boolean(activeLoc) && !err && bundleLocId !== activeLoc.id;

  if (locationsLoading && locations.length === 0) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[70vh] text-center" data-testid="home-loading">
        <Loader2 strokeWidth={1.5} className="w-10 h-10 text-accent mb-4 animate-spin" aria-hidden />
        <h1 className="text-xl font-semibold mb-2">Loading…</h1>
        <p className="text-neutral-400 max-w-xs">Syncing your saved locations.</p>
      </div>
    );
  }

  if (locations.length === 0) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[70vh] text-center" data-testid="home-empty">
        <MapPin strokeWidth={1.5} className="w-12 h-12 text-accent mb-4" />
        <h1 className="text-2xl font-semibold mb-2">Add your first location</h1>
        <p className="text-neutral-400 max-w-xs mb-6">
          Root Record waits until you save somewhere it should care about — pick a place to begin.
        </p>
        <button
          data-testid="home-add-location-cta"
          onClick={() => navigate('/locations/new')}
          className="bg-accent hover:bg-accentHover text-white px-5 py-3 rounded-sm flex items-center gap-2 active:scale-95"
        >
          <Plus strokeWidth={1.5} className="w-4 h-4" /> Add location
        </button>
        {err && (
          <div className="text-xs bg-sev-severe/10 border border-sev-severe/40 text-sev-severe p-2 mt-4 max-w-xs" data-testid="home-empty-error">
            {err}
          </div>
        )}
      </div>
    );
  }

  const obs = bundle?.current?.observation || {};
  const hourlyNow = bundle?.current?.hourly_now || {};
  const tempC = nwsScalarNumber(obs?.temperature);
  const feelsLikeC = nwsScalarNumber(obs?.feelsLike) ?? nwsScalarNumber(hourlyNow?.feelsLike);
  const dewPointC = nwsScalarNumber(obs?.dewpoint) ?? nwsScalarNumber(hourlyNow?.dewPoint);
  const wetBulbC = nwsScalarNumber(obs?.wetBulbTemperature) ?? nwsScalarNumber(hourlyNow?.wetBulb);
  const humidity = nwsScalarNumber(obs?.relativeHumidity) ?? nwsScalarNumber(hourlyNow?.relativeHumidity);
  const wind = nwsScalarNumber(obs?.windSpeed); // km/h
  const gust = nwsScalarNumber(obs?.windGust);
  const pressurePa = nwsScalarNumber(obs?.barometricPressure);
  const cloudPct = nwsScalarNumber(obs?.cloudCover) ?? nwsScalarNumber(hourlyNow?.cloudCover);
  const uvIndex = nwsScalarNumber(obs?.uvIndex);
  const precip1hMm = nwsScalarNumber(obs?.precip1h);
  const precip3hMm = nwsScalarNumber(obs?.precipPast3h);
  const precip6hMm = nwsScalarNumber(obs?.precipPast6h);
  const ceilingM = nwsScalarNumber(obs?.ceiling);
  const windDirSub =
    obs?.windDirection?.value !== undefined && obs.windDirection.value !== null
      ? `${Math.round(obs.windDirection.value)}°`
      : obs?.windDirectionCardinal || (typeof hourlyNow?.windDirection === 'string' ? hourlyNow.windDirection : '');
  const condition = safeText(hourlyNow?.shortForecast ?? obs?.textDescription, '—');
  const nowIconCode = hourlyNow?.icon ?? bundle?.current?.icon ?? null;
  const forecastPeriods = Array.isArray(bundle?.forecast?.periods) ? bundle.forecast.periods : [];
  const gridHigh = forecastPeriods.find((p) => p.isDaytime)?.temperature;
  const gridLow = forecastPeriods.find((p) => !p.isDaytime)?.temperature;
  const periodUnit = String(forecastPeriods[0]?.temperatureUnit || 'F')
    .trim()
    .toUpperCase() === 'C'
    ? 'C'
    : 'F';
  const hourlyGridUnits = bundle?.forecast?.hourly_grid_units === 'si' ? 'si' : 'us';
  const { high, low } = alignDailyHighLowWithNow(
    gridHigh,
    gridLow,
    periodUnit,
    tempC,
    hourlyNow?.temperature,
    hourlyNow?.temperatureUnit
  );

  return (
    <div className="animate-fadein lg:mx-auto lg:max-w-[min(1400px,calc(100%-2rem))]" data-testid="home-page">
      <header className="flex items-center justify-between px-4 pt-1 pb-2 lg:px-10 lg:pt-2">
        <LocationPicker locations={locations} activeId={activeId} onPick={setActive} />
        <button
          aria-label="Refresh"
          data-testid="home-refresh-button"
          onClick={handleRefresh}
          className={clsx(
            'p-2 rounded-sm border border-subtle text-neutral-300 hover:bg-containerHover active:scale-95',
            refreshing && 'animate-spinSlow'
          )}
        >
          <RefreshCw strokeWidth={1.5} className="w-4 h-4" />
        </button>
      </header>

      <section className="px-4 lg:px-10">
        {showWeatherSkeleton ? (
          <div className="space-y-4" data-testid="home-weather-loading">
            <div className="flex items-center gap-2 text-sm text-accent/70 py-1">
              <Loader2 strokeWidth={1.5} className="w-4 h-4 text-accent animate-spin shrink-0" aria-hidden />
              <span>
                Loading weather for <span className="text-white font-medium">{activeLoc.name}</span>…
              </span>
            </div>
            <div className="h-32 skeleton" />
            <div className="grid grid-cols-2 gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-20 skeleton" />
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Hero */}
            <div className="bg-container border border-subtle p-5 mb-3" data-testid="home-current-hero">
              <div className="text-[10px] font-mono uppercase tracking-widest text-accent/70 mb-2">Now</div>
              <div className="flex items-end justify-between">
                <div>
                  <div className="font-mono text-6xl leading-none tracking-tighter" data-testid="home-current-temp">
                    {tempC === undefined || tempC === null
                      ? (hourlyNow?.temperature !== undefined
                          ? fmtHourlyGridTemp(hourlyNow, hourlyGridUnits)
                          : '—')
                      : fmtTemp(tempC, 'C')}
                  </div>
                  <div className="mt-2 text-accent/80">{condition}</div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <AccuWeatherIcon code={nowIconCode} className="w-11 h-11 text-accent" title={safeText(condition, '')} />
                  <div className="text-right text-xs text-accent/70 font-mono">
                    {high !== undefined && <div>HIGH <span className="text-white">{fmtTemp(high, periodUnit)}</span></div>}
                    {low !== undefined && <div>LOW <span className="text-white">{fmtTemp(low, periodUnit)}</span></div>}
                  </div>
                </div>
              </div>
            </div>

            <WeatherAiCard
              paid={paid}
              aiData={aiData}
              loading={aiLoading}
              refreshing={aiRefreshing}
              error={aiError}
              onRefresh={handleAiRefresh}
            />

            {/* Bento metrics */}
            <div className="grid grid-cols-2 gap-2 mb-2">
              <Bento icon={Wind} label="Wind" value={fmtSpeedKmH(wind)} sub={windDirSub} />
              <Bento
                icon={Droplets}
                label="Humidity"
                value={
                  humidity != null && Number.isFinite(Number(humidity))
                    ? `${Math.round(Number(humidity))}%`
                    : '—'
                }
              />
              <Bento
                icon={Gauge}
                label="Pressure"
                value={
                  pressurePa != null && Number.isFinite(Number(pressurePa))
                    ? `${(Number(pressurePa) / 100).toFixed(0)} hPa`
                    : '—'
                }
              />
              <Bento icon={Sun} label="Visibility" value={obs?.visibility?.value != null ? fmtKmOrMi(obs.visibility.value / 1000, 1) : '—'} />
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4">
              <Bento icon={Thermometer} label="Feels like" value={feelsLikeC != null ? fmtTemp(feelsLikeC, 'C') : '—'} />
              <Bento icon={Thermometer} label="Dew point" value={dewPointC != null ? fmtTemp(dewPointC, 'C') : '—'} />
              <Bento icon={Thermometer} label="Wet bulb" value={wetBulbC != null ? fmtTemp(wetBulbC, 'C') : '—'} />
              <Bento icon={Wind} label="Gusts" value={gust != null ? fmtSpeedKmH(gust) : '—'} />
              <Bento icon={Cloud} label="Cloud cover" value={cloudPct != null ? `${Math.round(cloudPct)}%` : '—'} />
              <Bento icon={Sun} label="UV index" value={uvIndex != null ? String(uvIndex) : '—'} />
              <Bento icon={Umbrella} label="Precip (1h)" value={precip1hMm != null ? fmtMmOrIn(precip1hMm, 2) : '—'} />
              <Bento icon={Umbrella} label="Precip (3h)" value={precip3hMm != null ? fmtMmOrIn(precip3hMm, 2) : '—'} />
              <Bento icon={Umbrella} label="Precip (6h)" value={precip6hMm != null ? fmtMmOrIn(precip6hMm, 2) : '—'} />
              <Bento icon={Layers} label="Ceiling" value={ceilingM != null ? fmtMOrFt(ceilingM) : '—'} />
            </div>

            {/* Hourly */}
            {Array.isArray(bundle?.forecast?.hourly) && bundle.forecast.hourly.length > 0 && (
              <div className="mb-6">
                <h2 className="text-[10px] font-mono uppercase tracking-widest text-accent/70 mb-2">Next 12 hours</h2>
                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 pt-0.5" data-testid="home-hourly-strip">
                  {bundle.forecast.hourly.filter((p) => p && typeof p === 'object').slice(0, 12).map((p, idx) => (
                    <div
                      key={p.number != null ? p.number : `h-${idx}`}
                      className="flex min-w-[80px] max-w-[92px] shrink-0 flex-col bg-container border border-subtle px-2.5 py-3 text-center"
                    >
                      <div className="text-[10px] font-mono text-accent/70 shrink-0">
                        {new Date(p.startTime).toLocaleTimeString([], { hour: 'numeric' })}
                      </div>
                      <div className="mt-1 flex items-center justify-center shrink-0">
                        <AccuWeatherIcon code={p.icon} className="w-8 h-8 text-neutral-200" title={safeText(p?.shortForecast, '')} />
                      </div>
                      <div className="font-mono text-lg mt-1 shrink-0">
                        {fmtHourlyGridTemp(p, hourlyGridUnits)}
                      </div>
                      <div className="mt-2 min-h-[4rem] text-[10px] leading-snug text-accent/70 line-clamp-4 break-words hyphens-auto">
                        {safeText(p?.shortForecast, '—')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

                    {/* Daily forecast — standard access shows 3 days; members see 5 days. */}
            {forecastPeriods.length > 0 && (() => {
              // Pair Day/Night periods into one card per day. Handles both AccuWeather
              // (always Day 1 / Night 1 / Day 2 / Night 2…) and NWS (may start with a
              // standalone "Tonight" night period, then alternate).
              const pairs = [];
              let i = 0;
              while (i < forecastPeriods.length && pairs.length < maxForecastDays) {
                const p = forecastPeriods[i];
                if (!p) { i += 1; continue; }
                if (p.isDaytime === true) {
                  const next = forecastPeriods[i + 1];
                  if (next && next.isDaytime === false) {
                    pairs.push({ day: p, night: next });
                    i += 2;
                  } else {
                    pairs.push({ day: p, night: null });
                    i += 1;
                  }
                } else if (p.isDaytime === false) {
                  pairs.push({ day: null, night: p });
                  i += 1;
                } else {
                  i += 1;
                }
              }
              if (pairs.length === 0) return null;
              const todayKey = new Date().toDateString();
              const labelFor = (pair, idx) => {
                const ref = pair.day || pair.night;
                const rawName = String(ref?.name || '').trim();
                // AccuWeather placeholder names "Day N" / "Night N" → derive weekday from startTime.
                const isPlaceholder = /^(day|night)\s+\d+$/i.test(rawName);
                if (!isPlaceholder && rawName) return rawName;
                const d = ref?.startTime ? new Date(ref.startTime) : null;
                if (d && !Number.isNaN(d.getTime())) {
                  if (d.toDateString() === todayKey) return 'Today';
                  return d.toLocaleDateString(undefined, { weekday: 'short' });
                }
                return rawName || `Day ${idx + 1}`;
              };
              return (
                <div className="mb-6">
                  <h2 className="text-[10px] font-mono uppercase tracking-widest text-accent/70 mb-2">
                    Next {maxForecastDays} day{maxForecastDays === 1 ? '' : 's'}
                  </h2>
                  {!pro && !life && (
                    <button
                      type="button"
                      onClick={() => showUpsellModal()}
                      className="text-[10px] font-mono text-accent/80 mb-2 hover:text-accent text-left"
                      data-testid="home-forecast-upsell"
                    >
                      Members can view the {FORECAST_DAYS_PRO}-day forecast and live hazards →
                    </button>
                  )}
                  <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 pt-0.5" data-testid="home-daily-strip">
                    {pairs.map((pair, idx) => {
                      const ref = pair.day || pair.night;
                      const label = labelFor(pair, idx);
                      const phrase = safeText(pair.day?.shortForecast ?? pair.night?.shortForecast, '—');
                      const icon = pair.day?.icon ?? pair.night?.icon ?? null;
                      return (
                        <div
                          key={ref?.startTime || ref?.number || idx}
                          className="flex min-w-[112px] max-w-[140px] shrink-0 flex-col bg-container border border-subtle px-2.5 py-3 text-center"
                          data-testid="home-daily-cell"
                        >
                          <div className="text-[10px] font-mono text-accent/70 shrink-0">{label}</div>
                          <div className="mt-1 flex items-center justify-center shrink-0">
                            <AccuWeatherIcon code={icon} className="w-8 h-8 text-neutral-200" title={phrase} />
                          </div>
                          <div className="font-mono text-lg mt-1 shrink-0">
                            {pair.day ? fmtHourlyGridTemp(pair.day, hourlyGridUnits) : '—'}
                          </div>
                          <div className="font-mono text-xs text-accent/70 shrink-0">
                            {pair.night ? fmtHourlyGridTemp(pair.night, hourlyGridUnits) : '—'}
                          </div>
                          <div className="mt-2 min-h-[3.5rem] text-[10px] leading-snug text-accent/70 line-clamp-4 break-words hyphens-auto">
                            {phrase}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Alerts (NOAA + Canada) */}
            {(() => {
              const noaaRaw = bundle?.alerts?.alerts;
              const caRaw = bundle?.canada_alerts?.alerts;
              const noaaList = Array.isArray(noaaRaw) ? noaaRaw : [];
              const caList = Array.isArray(caRaw) ? caRaw : [];
              const src = String(bundle?.alerts?.source || '').toLowerCase();
              const inferred =
                src === 'accuweather' ? 'accuweather' : src === 'noaa' ? 'noaa' : 'noaa';
              const all = [
                ...noaaList.map((a) => ({ ...a, provider: a.provider || inferred })),
                ...caList.map((a) => ({ ...a, provider: a.provider || 'canada' })),
              ];
              if (!all.length) return null;
              return (
                <div className="mb-6">
                  <h2 className="text-[10px] font-mono uppercase tracking-widest text-accent/70 mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-sev-severe" /> Active alerts
                  </h2>
                  <div className="bg-container border border-subtle">
                    {all.slice(0, 5).map((a, i) => {
                      const c = severityClass(a.severity);
                      const title =
                        safeText(a.event, '') || safeText(a.headline, '') || 'Alert';
                      return (
                        <button
                          type="button"
                          key={a.id || i}
                          data-testid="home-alert-row"
                          onClick={() => navigate('/alert', { state: { alert: a } })}
                          className={clsx(
                            'w-full text-left p-3 border-b border-subtle last:border-0',
                            'hover:bg-containerHover active:opacity-90',
                            'flex gap-3 items-start'
                          )}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span
                                className={`text-[10px] uppercase tracking-widest px-2 py-0.5 border ${c.bg} ${c.text} ${c.border} font-mono`}
                              >
                                {alertSeverityLabel(a)} · {alertProviderLabel(a, bundle)}
                              </span>
                            </div>
                            <div className="text-sm font-medium leading-tight text-white">{title}</div>
                            <div className="text-xs text-accent/70 mt-1 line-clamp-3 break-words">
                              {alertPreviewText(a)}
                            </div>
                            <div className="text-[10px] font-mono text-accent/60 mt-1">
                              {formatTime(a.effective || a.sent)}
                            </div>
                          </div>
                          <ArrowUpRight
                            strokeWidth={1.5}
                            className="w-4 h-4 shrink-0 text-accent mt-1"
                            aria-hidden
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Recent earthquakes nearby */}
            {Array.isArray(bundle?.usgs?.events) && bundle.usgs.events.length > 0 && (
              <div className="mb-6">
                <h2 className="text-[10px] font-mono uppercase tracking-widest text-accent/70 mb-2">Recent earthquakes (300mi)</h2>
                <div className="bg-container border border-subtle">
                  {bundle.usgs.events.filter((e) => e && typeof e === 'object').slice(0, 4).map((e) => {
                    const detailUrl = usgsEventDetailUrl(e);
                    const rowClass = clsx(
                      'flex items-center gap-3 p-3 border-b border-subtle last:border-0',
                      detailUrl && 'no-underline text-inherit cursor-pointer hover:bg-containerHover active:opacity-90'
                    );
                    const inner = (
                      <>
                        <div className={clsx(
                          'w-10 h-10 shrink-0 flex items-center justify-center font-mono text-sm font-bold',
                          e.magnitude >= 7 ? 'bg-mag-critical text-white' :
                          e.magnitude >= 5 ? 'bg-mag-high text-black' :
                          e.magnitude >= 3 ? 'bg-mag-mid text-black' : 'bg-mag-low text-black'
                        )}>
                          {Number(e.magnitude).toFixed(1)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm truncate">{safeText(e.place, 'Unknown')}</div>
                          <div className="text-[10px] font-mono text-accent/70">
                            {e.depth_km != null &&
                              Number.isFinite(Number(e.depth_km)) &&
                              `${Number(e.depth_km).toFixed(0)} km · `}
                            {e.distance_miles != null && `${fmtMileOrKm(e.distance_miles)} away`}
                          </div>
                        </div>
                        {detailUrl ? (
                          <ArrowUpRight strokeWidth={1.5} className="w-4 h-4 shrink-0 text-accent" aria-hidden />
                        ) : (
                          <ArrowUpRight strokeWidth={1.5} className="w-4 h-4 shrink-0 text-accent/70" aria-hidden />
                        )}
                      </>
                    );
                    return detailUrl ? (
                      <a
                        key={e.id}
                        href={detailUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid="home-usgs-event-row"
                        className={rowClass}
                        aria-label={`Open USGS details for magnitude ${e.magnitude}`}
                      >
                        {inner}
                      </a>
                    ) : (
                      <div key={e.id} data-testid="home-usgs-event-row" className={rowClass}>
                        {inner}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {err && (
              <div className="text-xs bg-sev-severe/10 border border-sev-severe/40 text-sev-severe p-2 mb-4" data-testid="home-error">{err}</div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
