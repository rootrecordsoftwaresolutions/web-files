import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { formatTime, severityClass, clsx } from '../lib/format';
import { coerceAlertNarrative, alertDescriptionForDisplay } from '../lib/alertText';

function safeText(v, fallback = '—') {
  if (v == null) return fallback;
  if (typeof v === 'string') return v.trim() || fallback;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return fallback;
}

function alertProviderLabel(a) {
  const p = String(a?.provider || '').toLowerCase();
  if (p === 'accuweather') return 'Weather';
  if (p === 'canada') return 'Environment Canada';
  if (p === 'noaa') return 'NOAA / NWS';
  return 'Weather';
}

function alertSeverityLabel(a) {
  const s = a?.severity;
  if (s != null && s !== '' && Number.isFinite(Number(s))) return 'Alert';
  const t = safeText(s, '');
  return t || 'Info';
}

function Section({ title, children, className }) {
  if (children == null) return null;
  const s = typeof children === 'string' ? children.trim() : '';
  if (!s) return null;
  return (
    <div className={clsx('mb-5', className)}>
      <h2 className="text-[10px] font-mono uppercase tracking-widest text-accent/70 mb-2">{title}</h2>
      <div className="text-sm text-neutral-200 whitespace-pre-wrap leading-relaxed">{children}</div>
    </div>
  );
}

export default function AlertDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const alert = location.state?.alert;

  useEffect(() => {
    if (!alert || typeof alert !== 'object') {
      navigate('/', { replace: true });
    }
  }, [alert, navigate]);

  if (!alert || typeof alert !== 'object') {
    return null;
  }

  const c = severityClass(alert.severity);
  const title =
    coerceAlertNarrative(alert.event) ||
    safeText(alert.event, '') ||
    coerceAlertNarrative(alert.headline) ||
    safeText(alert.headline, 'Weather alert');
  const descFull = alertDescriptionForDisplay(alert);
  const headline =
    typeof alert.headline === 'string'
      ? alert.headline.trim()
      : descFull && descFull !== title
        ? descFull.slice(0, 400)
        : '';
  const showHeadline = headline && headline !== title && headline.length > title.length;
  const areaStr =
    typeof alert.areaDesc === 'string'
      ? alert.areaDesc.trim()
      : coerceAlertNarrative(alert.areaDesc);
  const instrStr =
    typeof alert.instruction === 'string'
      ? alert.instruction.trim()
      : coerceAlertNarrative(alert.instruction);
  const detailOk = alert.detailUrl && /^https?:\/\//i.test(String(alert.detailUrl));
  const hasNarrative = Boolean(descFull || instrStr || areaStr);

  return (
    <div className="min-h-screen bg-app text-white px-4 pb-8 pt-2" data-testid="alert-detail">
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center justify-center w-10 h-10 rounded border border-subtle bg-container hover:bg-containerHover active:opacity-90"
          aria-label="Back"
        >
          <ArrowLeft strokeWidth={1.5} className="w-5 h-5 text-accent" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-mono uppercase tracking-widest text-accent/60">Alert details</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span
          className={clsx(
            'text-[10px] uppercase tracking-widest px-2 py-0.5 border font-mono',
            c.bg,
            c.text,
            c.border
          )}
        >
          {alertSeverityLabel(alert)} · {alertProviderLabel(alert)}
        </span>
      </div>

      <h1 className="text-xl font-semibold leading-snug text-white mb-2">{title}</h1>
      {showHeadline ? <p className="text-sm text-accent/80 mb-4 leading-snug">{headline}</p> : null}

      <div className="text-[11px] font-mono text-accent/60 space-y-1 mb-6">
        {alert.effective || alert.sent ? (
          <div>
            Effective: {formatTime(alert.effective || alert.sent)}
            {alert.ends ? ` · Until ${formatTime(alert.ends)}` : ''}
          </div>
        ) : null}
        {alert.senderName ? <div>Issued by: {safeText(alert.senderName, '')}</div> : null}
      </div>

      <Section title="Areas">{areaStr}</Section>

      <Section title="Description">{descFull}</Section>

      <Section title="Instructions / safety">{instrStr}</Section>

      {!hasNarrative && detailOk ? (
        <p className="text-sm text-accent/80 mb-4">
          Narrative text for this bulletin was not included in the API response. Open the link below for the
          full statement (including maps and updates).
        </p>
      ) : null}

      {detailOk ? (
        <a
          href={String(alert.detailUrl)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 mt-2 px-4 py-3 bg-container border border-accent/40 text-accent text-sm font-medium hover:bg-containerHover active:opacity-90"
        >
          {String(alert.provider || '').toLowerCase() === 'accuweather'
            ? 'Open full alert details'
            : 'Open official alert page'}
          <ExternalLink strokeWidth={1.5} className="w-4 h-4 shrink-0" aria-hidden />
        </a>
      ) : String(alert.provider || '').toLowerCase() === 'noaa' ? (
        <p className="text-xs text-accent/50 mt-4">
          Full alert text above is from NOAA / National Weather Service data.
        </p>
      ) : null}
    </div>
  );
}
