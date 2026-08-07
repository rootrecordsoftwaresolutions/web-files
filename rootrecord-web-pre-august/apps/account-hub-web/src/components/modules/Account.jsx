import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { ScreenHeader, PageContainer, Section } from "../ui/Shell";
import { useAuth } from "../../contexts/AuthContext";
import { initialsFrom, fmtDateOnly } from "../../lib/format";
import {
  LogOut,
  ShieldCheck,
  CreditCard,
  Bell,
  HelpCircle,
  Info,
  ChevronRight,
  Sparkles,
  MessageSquare,
  Megaphone,
} from "lucide-react";
import { NATIVE_APP_VERSION } from "../../lib/nativeAppVersion";

const LINKS = [
  { to: "/security", label: "Security", desc: "Password, sessions", icon: ShieldCheck, testid: "account-link-security" },
  { to: "/subscription", label: "Subscription", desc: "Plan and billing", icon: CreditCard, testid: "account-link-subscription" },
  { to: "/notifications", label: "Notifications", desc: "Push and email", icon: Bell, testid: "account-link-notifications" },
  { to: "/developer-messages", label: "Developer messages", desc: "Release notes and notices", icon: Megaphone, testid: "account-link-developer-messages" },
  { to: "/about", label: "About", desc: "Version and contact", icon: Info, testid: "account-link-about" },
  { to: "/help", label: "Help", desc: "Contact links", icon: HelpCircle, testid: "account-link-help" },
  { to: "/feedback", label: "Feedback", desc: "Send a note to the team", icon: MessageSquare, testid: "account-link-feedback" },
];

export default function Account() {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  async function onSignOut() {
    await logout();
    nav("/auth", { replace: true });
  }

  const planLabel =
    user?.plan === "life" || user?.plan === "pro" ? "Member" : "Free";

  return (
    <>
      <ScreenHeader
        title="Account"
        subtitle="Profile and app settings"
        back={false}
      />
      <PageContainer>
        <Section>
          <div className="p-5 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-brand/15 border border-brand/30 flex items-center justify-center text-brand font-heading font-bold text-lg">
              {initialsFrom(user)}
            </div>
            <div className="flex-1 min-w-0">
              <p
                data-testid="account-user-name"
                className="font-heading text-base text-ink-primary truncate"
              >
                {user?.name || user?.email || "—"}
              </p>
              <p className="text-xs text-ink-tertiary truncate">{user?.email}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="chip" data-testid="account-plan-chip">
                  <Sparkles size={11} /> {planLabel}
                </span>
                <span className="text-[10px] text-ink-tertiary font-mono">
                  since {fmtDateOnly(user?.created_at)}
                </span>
              </div>
            </div>
          </div>
        </Section>

        <Section title="Manage">
          {LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              data-testid={l.testid}
              className="row hover:bg-bg-elevated"
            >
              <div className="flex items-center gap-3">
                <l.icon size={18} className="text-brand-light" />
                <div>
                  <p className="text-sm font-semibold text-ink-primary">
                    {l.label}
                  </p>
                  <p className="text-xs text-ink-tertiary">{l.desc}</p>
                </div>
              </div>
              <ChevronRight size={18} className="text-ink-tertiary" />
            </Link>
          ))}
        </Section>

        <Section>
          <button
            data-testid="account-signout-btn"
            onClick={onSignOut}
            className="row w-full text-left hover:bg-bg-elevated"
          >
            <div className="flex items-center gap-3">
              <LogOut size={18} className="text-[#FB7185]" />
              <span className="text-sm font-semibold text-[#FB7185]">
                Sign out
              </span>
            </div>
            <ChevronRight size={18} className="text-ink-tertiary" />
          </button>
        </Section>

        <p
          className="text-[11px] text-ink-tertiary text-center font-mono"
          data-testid="account-version"
        >
          Account Hub v{NATIVE_APP_VERSION}
        </p>
      </PageContainer>
    </>
  );
}
