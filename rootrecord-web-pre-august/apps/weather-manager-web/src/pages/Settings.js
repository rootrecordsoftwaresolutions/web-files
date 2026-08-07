import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LogOut,
  MapPin,
  Plus,
  Trash2,
  User,
  Settings as SettingsIcon,
  Mail,
  Globe,
  Bell,
  ChevronRight,
  ExternalLink,
  MessageCircle,
  Send,
  Megaphone,
  Monitor,
  HelpCircle,
  ShieldCheck,
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { NATIVE_APP_VERSION } from '../lib/nativeAppVersion';
import { api, getCachedLocations, session } from '../lib/api';
import { safeLocalStorage } from '../lib/storage';
import { getUnits, setUnits } from '../lib/format';
import useAccess from '../lib/useAccess';
import {
  memberStatusHint,
  memberStatusLabel,
  refreshSessionAccess,
  showUpsellModal,
} from '../lib/tierAccess';

/** Public RootRecord links (same as rootrecord.info / credentials). */
const CONTACT = {
  website: 'https://rootrecord.info/',
  contact: 'https://rootrecord.info/contact.html',
  terms: 'https://rootrecord.info/terms',
  privacy: 'https://rootrecord.info/privacy',
  discord: 'https://discord.gg/jBgRdgmsjB',
  telegram: 'https://t.me/rootrecordsupport',
  desktopWeb: 'https://weather.rootrecord.info/',
};

const IS_NATIVE_ANDROID = (() => {
  try { return Capacitor?.isNativePlatform?.() === true; } catch { return false; }
})();

function Section({ title, children, testId }) {
  return (
    <section className="mb-6" data-testid={testId}>
      <h2 className="text-[10px] font-mono uppercase tracking-widest text-accent/70 mb-2 px-4">{title}</h2>
      <div className="bg-container border border-subtle">{children}</div>
    </section>
  );
}

function Row({ icon: Icon, label, value, onClick, testId, danger }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className={`flex items-center gap-3 w-full p-4 border-b border-subtle last:border-0 hover:bg-containerHover active:scale-[.99] text-left ${danger ? 'text-sev-severe' : 'text-white'}`}
    >
      {Icon && <Icon strokeWidth={1.5} className="w-4 h-4 shrink-0 opacity-80" />}
      <div className="flex-1 min-w-0">
        <div className="text-sm">{label}</div>
        {value && <div className="text-[10px] font-mono text-accent/70 mt-0.5 truncate">{value}</div>}
      </div>
      {!danger && onClick && <ChevronRight strokeWidth={1.5} className="w-4 h-4 text-accent/70" />}
    </button>
  );
}

function ExternalLinkRow({ icon: Icon, label, hint, href, testId }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-testid={testId}
      className="flex items-center gap-3 w-full p-4 border-b border-subtle last:border-0 hover:bg-containerHover active:scale-[.99] text-left text-white no-underline"
    >
      {Icon && <Icon strokeWidth={1.5} className="w-4 h-4 shrink-0 opacity-80 text-accent" />}
      <div className="flex-1 min-w-0">
        <div className="text-sm">{label}</div>
        {hint && <div className="text-[10px] font-mono text-accent/70 mt-0.5 truncate">{hint}</div>}
      </div>
      <ExternalLink strokeWidth={1.5} className="w-4 h-4 text-accent/70 shrink-0" aria-hidden />
    </a>
  );
}

export default function Settings({ onSignedOut }) {
  const navigate = useNavigate();
  const [locations, setLocations] = useState([]);
  const [units, setUnitsState] = useState(getUnits());
  const [locErr, setLocErr] = useState('');
  const [noaaAlertsEnabled, setNoaaAlertsEnabled] = useState(true);
  const [noaaBusy, setNoaaBusy] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  const [debugText, setDebugText] = useState('');
  const [debugOpen, setDebugOpen] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.listLocations();
      setLocations(data || []);
      setLocErr('');
    } catch (_e) {
      const cached = getCachedLocations();
      setLocations(cached);
      if (cached.length) setLocErr('Could not sync locations. Showing saved device copy.');
    }
  };
  useEffect(() => { load(); }, []);

  const isAuthed = session.isAuthed();
  const email = session.getEmail();
  const { pro, life } = useAccess();
  const tierLabel = memberStatusLabel();
  const tierHint = memberStatusHint();
  const showUpgrade = isAuthed && !pro && !life;

  useEffect(() => {
    refreshSessionAccess();
  }, []);

  useEffect(() => {
    if (!session.isAuthed()) return;
    (async () => {
      try {
        const { data } = await api.getPrefs();
        if (typeof data?.noaa_alerts_enabled === 'boolean') setNoaaAlertsEnabled(data.noaa_alerts_enabled);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const onSignOut = () => {
    session.clearSession();
    onSignedOut?.();
    navigate('/');
  };

  const removeLoc = async (id) => {
    if (!window.confirm('Delete this saved location?')) return;
    try { await api.deleteLocation(id); load(); } catch (e) { alert(e?.response?.data?.detail || e.message); }
  };

  const toggleUnits = () => {
    const next = units === 'imperial' ? 'metric' : 'imperial';
    setUnits(next);
    setUnitsState(next);
  };

  const alertsUnlocked = pro || life;

  const toggleNoaaAlerts = async () => {
    if (!alertsUnlocked) {
      showUpsellModal();
      return;
    }
    const next = !noaaAlertsEnabled;
    setNoaaAlertsEnabled(next);
    if (!session.isAuthed()) return;
    setNoaaBusy(true);
    try {
      await api.setPrefs({ noaa_alerts_enabled: next });
    } catch {
      // revert on failure
      setNoaaAlertsEnabled(!next);
    } finally {
      setNoaaBusy(false);
    }
  };

  return (
    <div
      className="animate-fadein pb-8 lg:mx-auto lg:max-w-[min(960px,calc(100%-2rem))] lg:px-10"
      data-testid="settings-page"
    >
      <header
        className="flex items-center justify-between px-4 pt-2 pb-2 lg:px-0"
      >
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-xs text-accent/70 font-mono uppercase tracking-widest">Account · Locations · Preferences · Support</p>
        </div>
        <SettingsIcon strokeWidth={1.5} className="w-5 h-5 text-accent/70" />
      </header>

      <Section title="Account" testId="settings-account-section">
        {isAuthed ? (
          <>
            <Row icon={Mail} label="Signed in as" value={email || '—'} testId="settings-account-email" />
            <Row icon={Globe} label="Member status" value={tierLabel} testId="settings-tier" />
            <div className="px-4 py-2 border-b border-subtle text-[10px] font-mono text-accent/70" data-testid="settings-tier-hint">
              {tierHint}
            </div>
            {showUpgrade && (
              <Row
                icon={ShieldCheck}
                label="Membership options"
                value="Some resource-heavy features are members-only"
                onClick={() => showUpsellModal()}
                testId="settings-upgrade"
              />
            )}
            <Row icon={LogOut} label="Sign out of this device" onClick={onSignOut} testId="settings-signout" danger />
          </>
        ) : (
          <>
            <Row icon={User} label="Not signed in" value="Sign in for synced locations" testId="settings-guest" />
            <Row icon={LogOut} label="Sign in" onClick={() => navigate('/auth')} testId="settings-signin" />
          </>
        )}
      </Section>

      <Section title="Updates" testId="settings-developer-messages-section">
        <Row
          icon={Megaphone}
          label="Developer messages"
          value="Release notes and notices from RootRecord"
          onClick={() => navigate('/developer-messages')}
          testId="settings-open-developer-messages"
        />
      </Section>

      <Section title="Saved locations" testId="settings-locations-section">
        {locErr && (
          <div className="text-xs bg-sev-severe/10 border-b border-sev-severe/40 text-sev-severe p-3" data-testid="settings-locations-error">
            {locErr}
          </div>
        )}
        {locations.map((l) => (
          <div key={l.id} className="flex items-center gap-3 p-4 border-b border-subtle last:border-0">
            <MapPin strokeWidth={1.5} className="w-4 h-4 text-accent" />
            <div className="flex-1 min-w-0">
              <div className="text-sm truncate">{l.name}</div>
              <div className="text-[10px] font-mono text-accent/70">
                {Number.isFinite(Number(l.latitude)) && Number.isFinite(Number(l.longitude))
                  ? `${Number(l.latitude).toFixed(4)}, ${Number(l.longitude).toFixed(4)}`
                  : '—'}
              </div>
            </div>
            <button
              onClick={() => removeLoc(l.id)}
              data-testid={`settings-location-delete-${l.id}`}
              className="p-2 text-accent/70 hover:text-sev-severe active:scale-90"
              aria-label="Delete location"
            >
              <Trash2 strokeWidth={1.5} className="w-4 h-4" />
            </button>
          </div>
        ))}
        <button
          onClick={() => {
            if (locations.length < 5) navigate('/locations/new');
          }}
          disabled={locations.length >= 5}
          data-testid="settings-add-location"
          className={`flex items-center gap-3 w-full p-4 border-t border-subtle active:scale-[.99] ${
            locations.length >= 5 ? 'text-accent/50 cursor-not-allowed' : 'text-accent hover:bg-containerHover'
          }`}
        >
          <Plus strokeWidth={1.5} className="w-4 h-4" />
          {locations.length >= 5 ? '5 saved locations max' : 'Add location'}
        </button>
      </Section>

      <Section title="Preferences" testId="settings-prefs-section">
        <Row
          label="Units"
          value={units === 'imperial' ? 'Imperial — °F · mph · mi' : 'Metric — °C · km/h · km'}
          onClick={toggleUnits}
          testId="settings-units-toggle"
        />
      </Section>

      <Section title="Alerts" testId="settings-pro-section">
        <Row
          icon={Bell}
          label="Weather alert notifications (NOAA)"
          value={alertsUnlocked ? (noaaAlertsEnabled ? 'On' : 'Off') : 'Members only'}
          onClick={noaaBusy ? undefined : toggleNoaaAlerts}
          testId="settings-noaa-alerts-toggle"
        />
        <div className="p-4 pt-0 text-xs text-accent/70 leading-relaxed">
          {alertsUnlocked
            ? 'Push notifications for active NOAA alerts near your saved locations (Android). Allow notifications when prompted. US locations only.'
            : 'Kīlauea volcano alerts are included. Some additional alert categories require extra resources and are limited to members only.'}
        </div>
      </Section>

      {IS_NATIVE_ANDROID && (
        <Section title="Desktop version" testId="settings-desktop-section">
          <ExternalLinkRow
            icon={Monitor}
            label="Open on desktop — members"
            hint="weather.rootrecord.info — full experience in any desktop or laptop browser"
            href={CONTACT.desktopWeb}
            testId="settings-desktop-link"
          />
        </Section>
      )}

      <Section title="Contact & support" testId="settings-contact-section">
        <Row
          icon={HelpCircle}
          label="About & Help"
          value="Version, principles, and plans"
          onClick={() => navigate('/about')}
          testId="settings-open-about"
        />
        <Row
          icon={Send}
          label="Send feedback"
          value="In-app note to the team"
          onClick={() => navigate('/feedback')}
          testId="settings-open-feedback"
        />
        <ExternalLinkRow
          icon={Globe}
          label="Website"
          hint="rootrecord.info — products, pricing, FAQ"
          href={CONTACT.website}
          testId="settings-contact-website"
        />
        <ExternalLinkRow
          icon={Mail}
          label="Contact"
          hint="Message the team (contact form)"
          href={CONTACT.contact}
          testId="settings-contact-form"
        />
        <ExternalLinkRow
          icon={ShieldCheck}
          label="Terms of Service"
          hint="RootRecord app terms"
          href={CONTACT.terms}
          testId="settings-terms"
        />
        <ExternalLinkRow
          icon={ShieldCheck}
          label="Privacy Policy"
          hint="How RootRecord handles data"
          href={CONTACT.privacy}
          testId="settings-privacy"
        />
        <ExternalLinkRow
          icon={MessageCircle}
          label="Discord"
          hint="Community & support server"
          href={CONTACT.discord}
          testId="settings-contact-discord"
        />
        <ExternalLinkRow
          icon={Send}
          label="Telegram"
          hint="Public support — @rootrecordsupport"
          href={CONTACT.telegram}
          testId="settings-contact-telegram"
        />
      </Section>

      <p className="text-center text-[10px] font-mono text-accent/60 mt-8">
        <button
          type="button"
          className="text-inherit bg-transparent border-0 p-0 m-0 font-inherit"
          onClick={() => {
            const next = tapCount + 1;
            setTapCount(next);
            if (next >= 7) {
              setTapCount(0);
              const raw = safeLocalStorage.getItem('rrwm.lastFatal');
              setDebugText(raw || 'No stored fatal error.');
              setDebugOpen(true);
            }
          }}
          aria-label="Version"
          data-testid="settings-version"
        >
          Root Record Weather Manager Mobile · v{NATIVE_APP_VERSION}
        </button>
      </p>

      {debugOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-5 bg-black/80" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg bg-container border border-subtle rounded-sm p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <div className="text-sm font-semibold text-white">Debug info</div>
                <div className="text-[10px] font-mono text-accent/70 uppercase tracking-widest">Hidden · for internal support</div>
              </div>
              <button
                type="button"
                className="text-xs font-mono text-accent underline underline-offset-2"
                onClick={() => setDebugOpen(false)}
              >
                Close
              </button>
            </div>
            <pre className="text-[11px] leading-relaxed whitespace-pre-wrap break-words bg-app border border-subtle p-3 max-h-[50vh] overflow-auto">
              {debugText}
            </pre>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="px-3 py-2 rounded-sm bg-accent text-white text-sm font-semibold"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(debugText || '');
                  } catch {
                    /* ignore */
                  }
                }}
              >
                Copy
              </button>
              <button
                type="button"
                className="px-3 py-2 rounded-sm border border-subtle text-white text-sm font-semibold"
                onClick={() => {
                  safeLocalStorage.removeItem('rrwm.lastFatal');
                  setDebugText('Cleared.');
                }}
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
