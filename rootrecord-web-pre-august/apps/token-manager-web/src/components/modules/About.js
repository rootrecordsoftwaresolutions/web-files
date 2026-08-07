import React from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { NATIVE_APP_VERSION } from "../../lib/nativeAppVersion";

/**
 * About & Help — Token Manager.
 *
 * Layout mirrors Business Manager's About page (`Web/apps/business-manager-web/src/components/modules/Settings.jsx`)
 * so the five RootRecord products read the same way; copy is Token-Manager-specific. The version
 * string comes from package.json via `NATIVE_APP_VERSION`, which means the mobile builder
 * (`Mobile/token-manager-app/bump-and-build-release.bat`) bumps it automatically when the web
 * bundle is rebuilt. Never hard-code a version here.
 *
 * Token Manager is part of the RootRecord suite but does not sell its own membership tier today
 * (see `Web/apps/business-manager-web/src/components/UpsellModal.jsx` for the monetization
 * scope: Weather + Business + Kīlauea). The Plans section reflects that.
 */
export default function About() {
  const nav = useNavigate();
  return (
    <div className="page-shell pb-24" data-testid="about-page">
      <header
        className="sticky top-0 z-20 backdrop-blur-xl bg-bg-base/75 border-b border-white/5"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="px-4 py-3 flex items-center gap-2">
          <button
            type="button"
            className="btn btn-ghost p-2 -ml-2"
            onClick={() => nav(-1)}
            aria-label="Back"
            data-testid="about-back"
          >
            <ChevronLeft size={22} />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-ink-primary truncate">About &amp; Help</h1>
            <p className="text-[11px] text-ink-tertiary uppercase tracking-widest truncate">
              Version, principles, and plans
            </p>
          </div>
        </div>
      </header>

      <div className="px-4 pt-3 space-y-4">
        <div className="card p-4">
          <div className="font-semibold text-ink-primary">RootRecord Token Manager</div>
          <div className="text-[12px] text-ink-tertiary mt-1 mono">Mobile build · v{NATIVE_APP_VERSION}</div>
          <div className="text-sm text-ink-secondary mt-3">
            Manage Solana wallets, addresses, and on-chain transfers from your phone — same account you use
            across every RootRecord app.
          </div>
        </div>

        <div className="card p-4">
          <div className="label mb-2">What RootRecord stands for</div>
          <div className="text-sm text-ink-secondary space-y-1">
            <p>• Reliability first</p>
            <p>• Clarity over cleverness</p>
            <p>• Operability in the real world</p>
            <p>• Composable services</p>
            <p>• Respectful communication</p>
          </div>
        </div>

        <div className="card p-4">
          <div className="label mb-2">Plans</div>
          <div className="text-sm text-ink-secondary space-y-2">
            <p>
              Token Manager is bundled with your RootRecord account — sign in with the same email
              you use for Weather Manager, Business Manager, or Kīlauea Alerts. No separate
              subscription required.
            </p>
            <p>
              Membership on any other RootRecord product applies across the suite. Manage it in{" "}
              <b className="text-ink-primary">Account Hub</b>.
            </p>
          </div>
        </div>

        <div className="card p-4">
          <div className="label mb-2">Custom app development</div>
          <div className="text-sm text-ink-secondary space-y-2">
            <p>Need something built for your workflow, team, or customers? Tell us purpose, platforms, scope, and timeline.</p>
            <p>
              <a className="text-phos font-semibold" href="https://rootrecord.info/app-build-request" target="_blank" rel="noopener noreferrer">
                rootrecord.info/app-build-request
              </a>
            </p>
          </div>
        </div>

        <div className="card p-4">
          <div className="label mb-2">Where to get help</div>
          <div className="text-sm text-ink-secondary">
            <p>
              Use <b className="text-ink-primary">Send feedback</b> in Settings for bug reports, ideas, or
              membership questions. Visit{" "}
              <a className="text-phos" href="https://rootrecord.info" target="_blank" rel="noopener noreferrer">
                rootrecord.info
              </a>{" "}
              for the latest.
            </p>
          </div>
        </div>

        <div className="card p-4">
          <div className="label mb-2">Legal</div>
          <div className="text-sm text-ink-secondary space-y-2">
            <p>
              <a className="text-phos font-semibold" href="https://rootrecord.info/terms" target="_blank" rel="noopener noreferrer">
                Terms of Service
              </a>
            </p>
            <p>
              <a className="text-phos font-semibold" href="https://rootrecord.info/privacy" target="_blank" rel="noopener noreferrer">
                Privacy Policy
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
