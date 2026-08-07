import React from "react";
import { Link } from "react-router-dom";
import { ScreenHeader, PageContainer, Section } from "../ui/Shell";
import { Shield, Globe, Github, Mail, MessageSquare, Rocket, Monitor } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { NATIVE_APP_VERSION } from "../../lib/nativeAppVersion";

const IS_NATIVE_ANDROID = (() => {
  try { return Capacitor?.isNativePlatform?.() === true; } catch { return false; }
})();

export function About() {
  return (
    <>
      {/* Layout mirrors Business Manager's About (`Web/apps/business-manager-web/src/components/modules/Settings.jsx`)
          so the five products read the same way; copy is Account-Hub-specific. Version is pulled from
          package.json via `NATIVE_APP_VERSION` so the build script bumps it automatically. */}
      <ScreenHeader title="About & Help" subtitle="Version, principles, and plans" />
      <PageContainer>
        <Section>
          <div className="p-4 space-y-3 text-sm">
            <p className="font-heading font-bold text-base text-ink-primary">RootRecord Account Hub</p>
            <p className="text-ink-secondary">Mobile build · v{NATIVE_APP_VERSION}</p>
            <p className="text-ink-secondary">
              One sign-in, one membership status, one place to manage security and preferences across every RootRecord app.
            </p>
          </div>
        </Section>

        <Section title="What RootRecord stands for">
          <div className="p-4 text-sm text-ink-secondary space-y-1">
            <p>• Reliability first</p>
            <p>• Clarity over cleverness</p>
            <p>• Operability in the real world</p>
            <p>• Composable services</p>
            <p>• Respectful communication</p>
          </div>
        </Section>

        <Section title="Plans">
          <div className="p-4 text-sm text-ink-secondary space-y-2">
            <p>
              <b className="text-ink-primary">Membership</b> on any RootRecord product applies across the suite —
              Weather Manager, Business Manager, and Kīlauea Alerts. Manage it from <b className="text-ink-primary">Account</b>.
            </p>
            <p>
              <b className="text-ink-primary">Free</b> keeps every account fully functional for sign-in, billing, and
              preferences; product-specific limits are documented in each product's About page.
            </p>
          </div>
        </Section>

        {IS_NATIVE_ANDROID && (
          <Section title="Desktop version">
            <LinkRow
              icon={Monitor}
              label="Open Account Hub on desktop — members"
              href="https://account.rootrecord.info/"
              testid="about-link-desktop"
            />
            <p className="text-xs text-ink-tertiary px-4 py-2">
              account.rootrecord.info — same account, full experience in any desktop or laptop browser.
            </p>
          </Section>
        )}

        <Section title="Custom app development">
          <div className="p-4 text-sm text-ink-secondary space-y-2">
            <p>Need something built for your workflow, team, or customers? Tell us purpose, platforms, scope, and timeline.</p>
            <p>
              <a className="text-brand font-semibold" href="https://rootrecord.info/app-build-request" target="_blank" rel="noreferrer">
                rootrecord.info/app-build-request
              </a>
            </p>
          </div>
        </Section>

        <Section title="Where to get help">
          <div className="p-4 text-sm text-ink-secondary">
            <p>
              Use <b className="text-ink-primary">Feedback</b> from the Account menu for bug reports, ideas, or membership
              questions. Visit <a className="text-brand" href="https://rootrecord.info" target="_blank" rel="noreferrer">rootrecord.info</a> for the latest.
            </p>
          </div>
        </Section>

        <Section title="Links">
          <LinkRow icon={Globe} label="rootrecord.info" href="https://rootrecord.info" testid="about-link-web" />
          <LinkRow icon={Shield} label="Terms of Service" href="https://rootrecord.info/terms" testid="about-link-terms" />
          <LinkRow icon={Shield} label="Privacy &amp; security" href="https://rootrecord.info/privacy" testid="about-link-privacy" />
          <LinkRow icon={Github} label="Public releases" href="https://github.com/RootRecord" testid="about-link-github" />
          <LinkRow icon={Rocket} label="Custom app development" href="https://rootrecord.info/app-build-request" testid="about-link-app-build" />
        </Section>
      </PageContainer>
    </>
  );
}

export function Help() {
  return (
    <>
      <ScreenHeader title="Help &amp; feedback" subtitle="We read every message" />
      <PageContainer>
        <Section title="Contact">
          <LinkRow
            icon={Mail}
            label="support@rootrecord.info"
            href="mailto:support@rootrecord.info"
            testid="help-link-email"
          />
          <Link
            to="/feedback"
            data-testid="help-link-feedback"
            className="row hover:bg-bg-elevated no-underline text-inherit"
          >
            <div className="flex items-center gap-3">
              <MessageSquare size={18} className="text-brand-light" />
              <span className="text-sm font-semibold text-ink-primary">Send in-app feedback</span>
            </div>
          </Link>
        </Section>
        <Section title="Custom app development">
          <LinkRow
            icon={Rocket}
            label="Request a tailored build"
            href="https://rootrecord.info/app-build-request"
            testid="help-link-app-build"
          />
        </Section>
        <p className="text-xs text-ink-tertiary px-2">
          Describe what you were doing and include your device model when
          possible. Screenshots help a lot.
        </p>
      </PageContainer>
    </>
  );
}

function LinkRow({ icon: Icon, label, href, testid }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-testid={testid}
      className="row hover:bg-bg-elevated"
    >
      <div className="flex items-center gap-3">
        <Icon size={18} className="text-brand-light" />
        <span
          className="text-sm font-semibold text-ink-primary"
          dangerouslySetInnerHTML={{ __html: label }}
        />
      </div>
    </a>
  );
}
