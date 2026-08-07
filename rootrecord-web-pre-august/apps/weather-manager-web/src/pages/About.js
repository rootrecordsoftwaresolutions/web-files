import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { NATIVE_APP_VERSION } from '../lib/nativeAppVersion';

/**
 * About & Help — Weather Manager.
 *
 * Layout mirrors Business Manager's About page (`Web/apps/business-manager-web/src/components/modules/Settings.jsx`)
 * so the five RootRecord products read the same way; copy is Weather-Manager-specific. The version
 * string comes from package.json via `NATIVE_APP_VERSION`, which means the mobile builder
 * (`Mobile/weather-manager-mobile/bump-and-build-release.bat`) bumps it automatically when the web
 * bundle is rebuilt. Never hard-code a version here.
 */

function Section({ title, children }) {
  return (
    <section className="mb-6">
      {title && (
        <h2 className="text-[10px] font-mono uppercase tracking-widest text-accent/70 mb-2 px-4">{title}</h2>
      )}
      <div className="bg-container border border-subtle">{children}</div>
    </section>
  );
}

export default function About() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-app pb-8" data-testid="about-page">
      <header
        className="flex items-center gap-3 p-4 border-b border-subtle"
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 rounded-sm text-accent hover:bg-containerHover"
          aria-label="Back"
          data-testid="about-back"
        >
          <ArrowLeft strokeWidth={1.5} className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg font-semibold tracking-tight">About &amp; Help</h1>
          <p className="text-[10px] font-mono uppercase tracking-widest text-accent/70">
            Version, principles, and plans
          </p>
        </div>
      </header>

      <div className="px-4 pt-4">
        <Section>
          <div className="p-4 space-y-3 text-sm">
            <p className="font-semibold text-base text-white">RootRecord Weather Manager</p>
            <p className="text-accent/90">Mobile build · v{NATIVE_APP_VERSION}</p>
            <p className="text-accent/90">
              Hyperlocal weather, NOAA alerts, extended forecasts, and HVO volcanic notices —
              purpose-built for the Pacific and beyond.
            </p>
          </div>
        </Section>

        <Section title="What RootRecord stands for">
          <div className="p-4 text-sm text-accent/90 space-y-1">
            <p>• Reliability first</p>
            <p>• Clarity over cleverness</p>
            <p>• Operability in the real world</p>
            <p>• Composable services</p>
            <p>• Respectful communication</p>
          </div>
        </Section>

        <Section title="Plans">
          <div className="p-4 text-sm text-accent/90 space-y-2">
            <p>
              <b className="text-white">Pro</b> unlocks up to 5 saved locations, hazard map layers,
              push alerts, and the full desktop dashboard at weather.rootrecord.info.
            </p>
            <p>
              <b className="text-white">Free</b> keeps one location with basic forecasts and the
              latest developer messages — no account required.
            </p>
          </div>
        </Section>

        <Section title="Custom app development">
          <div className="p-4 text-sm text-accent/90 space-y-2">
            <p>Need something built for your workflow, team, or customers? Tell us purpose, platforms, scope, and timeline.</p>
            <p>
              <a className="text-accent font-semibold" href="https://rootrecord.info/app-build-request" target="_blank" rel="noreferrer">
                rootrecord.info/app-build-request
              </a>
            </p>
          </div>
        </Section>

        <Section title="Where to get help">
          <div className="p-4 text-sm text-accent/90">
            <p>
              Use <b className="text-white">Feedback</b> in Settings for bug reports, ideas, or
              membership questions. Visit{' '}
              <a className="text-accent" href="https://rootrecord.info" target="_blank" rel="noreferrer">
                rootrecord.info
              </a>{' '}
              for the latest.
            </p>
          </div>
        </Section>

        <Section title="Legal">
          <div className="p-4 text-sm text-accent/90 space-y-2">
            <p>
              <a className="text-accent font-semibold" href="https://rootrecord.info/terms" target="_blank" rel="noreferrer">
                Terms of Service
              </a>
            </p>
            <p>
              <a className="text-accent font-semibold" href="https://rootrecord.info/privacy" target="_blank" rel="noreferrer">
                Privacy Policy
              </a>
            </p>
          </div>
        </Section>
      </div>
    </div>
  );
}
