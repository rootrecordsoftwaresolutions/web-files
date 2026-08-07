import React from "react";
import { Link } from "react-router-dom";
import { ScreenHeader, PageContainer, Section } from "../ui/Shell";
import { useAuth } from "../../contexts/AuthContext";
import { REGISTERED_APPS } from "../../lib/apps";
import { initialsFrom } from "../../lib/format";
import {
  Sparkles,
  Cloud,
  Briefcase,
  ShieldCheck,
  Flame,
  ChevronRight,
  Coins,
  ArrowUpRight,
} from "lucide-react";

const ICONS = { Cloud, Briefcase, ShieldCheck, Flame };

export default function Home() {
  const { user } = useAuth();

  const planLabel =
    user?.plan === "life"
      ? "Member"
      : user?.plan === "pro"
      ? "Member"
      : "Free";

  return (
    <>
      <ScreenHeader
        title="Account Hub"
        subtitle="Your RootRecord home"
        back={false}
      />
      <PageContainer>
        {/* Identity card */}
        <Section>
          <div className="p-5 flex items-center gap-4">
            <div
              data-testid="home-avatar"
              className="w-14 h-14 rounded-2xl bg-brand/15 border border-brand/30 flex items-center justify-center text-brand font-heading font-bold text-lg"
            >
              {initialsFrom(user)}
            </div>
            <div className="flex-1 min-w-0">
              <p
                data-testid="home-user-name"
                className="font-heading text-lg text-ink-primary truncate"
              >
                {user?.name || user?.email || "—"}
              </p>
              <p className="text-xs text-ink-tertiary truncate">{user?.email}</p>
              <div className="flex items-center gap-2 mt-2">
                <PlanBadge plan={user?.plan} label={planLabel} />
                {user?.subscription_status && user.subscription_status !== "none" && (
                  <span className="chip" data-testid="home-subscription-status">
                    {user.subscription_status}
                  </span>
                )}
              </div>
            </div>
          </div>
        </Section>

        {/* Quick access to connected apps */}
        <Section
          title="App install links"
          action={
            <Link
              to="/apps"
              data-testid="home-see-all-apps"
              className="text-xs text-brand-light hover:text-brand"
            >
              All apps
            </Link>
          }
        >
          <div className="divide-y divide-white/5">
            {REGISTERED_APPS.map((app) => {
              const Icon = ICONS[app.iconKey] || ShieldCheck;
              const isCurrent = app.status === "current";
              return (
                <Link
                  key={app.id}
                  to="/apps"
                  data-testid={`home-app-${app.id}`}
                  className="row hover:bg-bg-elevated"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{
                        background: `${app.brand}22`,
                        color: app.brand,
                        border: `1px solid ${app.brand}44`,
                      }}
                    >
                      <Icon size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink-primary truncate">
                        {app.name}
                        {isCurrent && (
                          <span className="ml-2 text-[10px] text-brand font-mono">
                            · this app
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-ink-tertiary truncate">
                        {app.tagline}
                      </p>
                    </div>
                  </div>
                  {isCurrent ? (
                    <ChevronRight size={18} className="text-ink-tertiary" />
                  ) : (
                    <ArrowUpRight size={18} className="text-ink-tertiary" />
                  )}
                </Link>
              );
            })}
          </div>
        </Section>

        {/* Quick links */}
        <Section title="Manage">
          <Link
            to="/security"
            data-testid="home-manage-security"
            className="row hover:bg-bg-elevated"
          >
            <div className="flex items-center gap-3">
              <ShieldCheck size={18} className="text-brand-light" />
              <span className="text-sm font-semibold text-ink-primary">
                Security &amp; sessions
              </span>
            </div>
            <ChevronRight size={18} className="text-ink-tertiary" />
          </Link>
          <Link
            to="/subscription"
            data-testid="home-manage-subscription"
            className="row hover:bg-bg-elevated"
          >
            <div className="flex items-center gap-3">
              <Sparkles size={18} className="text-brand-light" />
              <span className="text-sm font-semibold text-ink-primary">
                Subscription &amp; billing
              </span>
            </div>
            <ChevronRight size={18} className="text-ink-tertiary" />
          </Link>
          <Link
            to="/notifications"
            data-testid="home-manage-notifications"
            className="row hover:bg-bg-elevated"
          >
            <div className="flex items-center gap-3">
              <Coins size={18} className="text-brand-light" />
              <span className="text-sm font-semibold text-ink-primary">
                Notifications &amp; preferences
              </span>
            </div>
            <ChevronRight size={18} className="text-ink-tertiary" />
          </Link>
        </Section>
      </PageContainer>
    </>
  );
}

function PlanBadge({ plan, label }) {
  if (plan === "pro" || plan === "life") {
    return (
      <span
        data-testid="plan-badge-pro"
        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-widest bg-brand/15 border border-brand/30 text-brand-light"
      >
        <Sparkles size={10} /> {label}
      </span>
    );
  }
  return (
    <span data-testid="plan-badge-free" className="chip">
      {label}
    </span>
  );
}
