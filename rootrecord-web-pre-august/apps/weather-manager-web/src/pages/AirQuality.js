import React, { useEffect, useMemo, useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { Haze, RefreshCw, Loader2, ShieldCheck } from 'lucide-react';
import { api, getCachedLocations } from '../lib/api';
import { safeLocalStorage } from '../lib/storage';
import { clsx, formatTime } from '../lib/format';
import useAccess from '../lib/useAccess';
import { BILLING_URL, showUpsellModal } from '../lib/tierAccess';

const TAB_KEYS = [
  { id: 'current', label: 'Now', testId: 'aq-tab-current' },
  { id: 'hourly', label: '12 hr', testId: 'aq-tab-hourly' },
  { id: 'daily', label: '5 day', testId: 'aq-tab-daily' },
];

function aqiStyle(categoryColor) {
  const c = String(categoryColor || '').trim();
  if (/^#[0-9a-f]{3,8}$/i.test(c)) return { backgroundColor: c, color: '#0a0a0a' };
  return { backgroundColor: 'rgba(255,255,255,0.12)', color: '#fff' };
}

function AirQualityProGate() {
  return (
    <div
      className="bg-container border border-subtle p-6 text-center"
      data-testid="air-quality-pro-gate"
    >
      <ShieldCheck strokeWidth={1.5} className="w-8 h-8 text-accent mx-auto mb-3" />
      <p className="text-sm text-white font-medium mb-1">Air quality requires additional resources</p>
      <p className="text-xs text-accent/70 mb-4 max-w-sm mx-auto">
        Live AQI, pollutant details, and air quality forecasts are limited to members only.
      </p>
      <div className="flex flex-col sm:flex-row gap-2 justify-center">
        <button
          type="button"
          onClick={() => showUpsellModal()}
          className="px-4 py-2 rounded bg-accent text-black text-sm font-medium hover:opacity-90"
          data-testid="air-quality-upgrade-btn"
        >
          View member features
        </button>
        <a
          href={BILLING_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 rounded border border-subtle text-sm text-neutral-200 hover:bg-white/5 no-underline"
          data-testid="air-quality-billing-link"
        >
          Plans &amp; billing
        </a>
      </div>
    </div>
  );
}

function AqiBadge({ index, category, categoryColor, large }) {
  const idx = index != null ? Math.round(Number(index)) : '—';
  return (
    <div
      className={clsx(
        'inline-flex flex-col items-center justify-center rounded-lg font-semibold',
        large ? 'min-w-[5.5rem] px-4 py-3' : 'min-w-[3.25rem] px-2 py-1.5 text-sm'
      )}
      style={aqiStyle(categoryColor)}
      data-testid="aq-index-badge"
    >
      <span className={large ? 'text-3xl leading-none' : 'text-lg leading-none'}>{idx}</span>
      {category ? (
        <span className={clsx('font-mono uppercase tracking-wider opacity-90', large ? 'text-[10px] mt-1' : 'text-[9px]')}>
          {category}
        </span>
      ) : null}
    </div>
  );
}

function PollutantList({ pollutants }) {
  if (!pollutants?.length) return null;
  return (
    <ul className="mt-4 space-y-2" data-testid="aq-pollutants">
      {pollutants.map((p) => (
        <li
          key={`${p.type}-${p.name}`}
          className="flex items-center justify-between gap-3 border border-subtle bg-app/40 px-3 py-2 text-sm"
        >
          <div>
            <div className="text-white font-medium">{p.name || p.type}</div>
            {p.value != null && p.unit ? (
              <div className="text-xs text-accent/60 font-mono">
                {p.value} {p.unit}
              </div>
            ) : null}
          </div>
          <div className="text-right shrink-0">
            {p.index != null ? (
              <span className="text-white font-mono">{Math.round(p.index)}</span>
            ) : null}
            {p.category ? <div className="text-[10px] text-accent/70 uppercase">{p.category}</div> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

function SnapshotCard({ snap, compact }) {
  if (!snap) return <p className="text-sm text-accent/60 p-4">No data for this period.</p>;
  const when = snap.epochDate ? formatTime(snap.epochDate * 1000) : snap.date ? String(snap.date) : '';
  return (
    <div className={clsx('border border-subtle bg-container p-4', compact && 'py-3')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {when ? <p className="text-xs font-mono text-accent/70 uppercase tracking-widest mb-2">{when}</p> : null}
          {snap.dominantPollutant ? (
            <p className="text-sm text-white/90">
              Dominant: <span className="text-accent">{snap.dominantPollutant}</span>
            </p>
          ) : null}
          {snap.hazardStatement ? (
            <p className="text-xs text-neutral-300 mt-2 leading-relaxed">{snap.hazardStatement}</p>
          ) : null}
        </div>
        <AqiBadge index={snap.overallIndex} category={snap.category} categoryColor={snap.categoryColor} />
      </div>
      {!compact ? <PollutantList pollutants={snap.pollutants} /> : null}
    </div>
  );
}

export default function AirQuality() {
  const { pro, life } = useAccess();
  const unlocked = pro || life;
  const [tab, setTab] = useState('current');
  const [activeLoc, setActiveLoc] = useState(null);
  const [bundle, setBundle] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.listLocations();
        const id = safeLocalStorage.getItem('rrwm.activeLocationId');
        const loc = (data || []).find((l) => l.id === id) || (data || [])[0] || null;
        setActiveLoc(loc);
      } catch (e) {
        const cached = getCachedLocations();
        const id = safeLocalStorage.getItem('rrwm.activeLocationId');
        const loc = cached.find((l) => l.id === id) || cached[0] || null;
        setActiveLoc(loc);
        setErr(loc ? 'Using saved location from this device.' : String(e?.message || e));
      }
    })();
  }, []);

  const loadAirQuality = async () => {
    if (!unlocked) {
      showUpsellModal();
      return;
    }
    if (!activeLoc?.latitude || !activeLoc?.longitude) {
      setErr('Add a saved location in Settings to see air quality.');
      return;
    }
    setLoading(true);
    setErr('');
    try {
      const { data } = await api.airQuality(activeLoc.latitude, activeLoc.longitude);
      setBundle(data);
      if (!data?.available) setErr('Air quality is unavailable for this location right now.');
    } catch (e) {
      const status = e?.response?.status;
      const detail = e?.response?.data?.detail;
      if (detail === 'pro_required') {
        showUpsellModal();
      } else if (status === 404) {
        setErr('Air quality is not available yet — update the app or try again shortly.');
      } else {
        setErr(String(e?.response?.data?.message || detail || e?.message || e));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!unlocked || !activeLoc) return;
    loadAirQuality();
  }, [unlocked, activeLoc?.id]); // eslint-disable-line

  const locLabel = useMemo(() => {
    if (!activeLoc) return 'No location';
    const parts = [activeLoc.name, activeLoc.city, activeLoc.state].filter(Boolean);
    return parts[0] || 'Saved location';
  }, [activeLoc]);

  const hourly = bundle?.hourly || [];
  const daily = bundle?.daily || [];

  return (
    <div className="animate-fadein lg:mx-auto lg:max-w-[min(1400px,calc(100%-2rem))]" data-testid="air-quality-page">
      <header className="flex items-center justify-between px-4 pt-2 pb-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Air quality</h1>
          <p className="text-xs text-accent/70 font-mono uppercase tracking-widest">
            {locLabel}
          </p>
        </div>
        <button
          type="button"
          aria-label="Refresh air quality"
          data-testid="air-quality-refresh"
          onClick={loadAirQuality}
          className={clsx(
            'p-2 rounded-sm border border-subtle hover:bg-containerHover active:scale-95',
            loading && 'animate-spinSlow'
          )}
        >
          {loading ? <Loader2 className="w-5 h-5" /> : <RefreshCw className="w-5 h-5" />}
        </button>
      </header>

      {!unlocked ? (
        <div className="px-4 pb-8">
          <AirQualityProGate />
        </div>
      ) : (
        <>
          {err ? (
            <p className="px-4 text-sm text-amber-200/90 mb-2" data-testid="air-quality-error">
              {err}
            </p>
          ) : null}

          {bundle?.current && tab === 'current' && !loading ? (
            <div className="px-4 pb-3">
              <div className="flex items-center gap-4 border border-subtle bg-container p-5">
                <Haze strokeWidth={1.25} className="w-10 h-10 text-accent shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono uppercase tracking-widest text-accent/70 mb-1">Current AQI</p>
                  {bundle.current.dominantPollutant ? (
                    <p className="text-sm text-white/80 truncate">{bundle.current.dominantPollutant}</p>
                  ) : null}
                </div>
                <AqiBadge
                  index={bundle.current.overallIndex}
                  category={bundle.current.category}
                  categoryColor={bundle.current.categoryColor}
                  large
                />
              </div>
            </div>
          ) : null}

          <Tabs.Root value={tab} onValueChange={setTab} className="px-4 pb-8">
            <Tabs.List className="flex gap-1 border-b border-subtle mb-4 overflow-x-auto">
              {TAB_KEYS.map((t) => (
                <Tabs.Trigger
                  key={t.id}
                  value={t.id}
                  data-testid={t.testId}
                  className={clsx(
                    'px-4 py-2 text-sm font-medium font-mono uppercase tracking-widest border-b-2 -mb-px transition-colors whitespace-nowrap',
                    tab === t.id
                      ? 'border-accent text-accent'
                      : 'border-transparent text-accent/50 hover:text-accent/80'
                  )}
                >
                  {t.label}
                </Tabs.Trigger>
              ))}
            </Tabs.List>

            <Tabs.Content value="current">
              {loading && !bundle ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-accent" />
                </div>
              ) : (
                <SnapshotCard snap={bundle?.current} />
              )}
            </Tabs.Content>

            <Tabs.Content value="hourly" className="space-y-2">
              {hourly.length === 0 && !loading ? (
                <p className="text-sm text-accent/60">No hourly forecast.</p>
              ) : (
                hourly.map((h, i) => <SnapshotCard key={h.epochDate || i} snap={h} compact />)
              )}
            </Tabs.Content>

            <Tabs.Content value="daily" className="space-y-2">
              {daily.length === 0 && !loading ? (
                <p className="text-sm text-accent/60">No daily forecast.</p>
              ) : (
                daily.map((d, i) => <SnapshotCard key={d.epochDate || i} snap={d} compact />)
              )}
            </Tabs.Content>
          </Tabs.Root>

          {bundle?.fetched_at ? (
            <p className="px-4 pb-6 text-[10px] text-accent/50 font-mono uppercase tracking-wider">
              Model forecast · updated {formatTime(bundle.fetched_at)}
              {bundle.model_note ? (
                <span className="block normal-case tracking-normal mt-1 text-accent/40">{bundle.model_note}</span>
              ) : null}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
