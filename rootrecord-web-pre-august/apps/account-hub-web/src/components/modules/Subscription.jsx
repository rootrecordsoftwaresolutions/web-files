import React, { useState } from "react";
import { ScreenHeader, PageContainer, Section, Toast, useToast } from "../ui/Shell";
import { useAuth } from "../../contexts/AuthContext";
import { formatApiError } from "../../lib/api";
import { Sparkles, RefreshCw, ExternalLink, CreditCard } from "lucide-react";

export default function Subscription() {
  const { user, refreshEntitlement } = useAuth();
  const { toast, show, clear } = useToast();
  const [busy, setBusy] = useState(false);

  const plan = user?.plan || "free";
  const isPaid = plan === "pro" || plan === "life";

  async function onRefresh() {
    setBusy(true);
    try {
      const data = await refreshEntitlement();
      const label = data?.life_member || data?.pro_unlocked ? "Member" : "Free";
      show(`Plan refreshed: ${label}`, "success");
    } catch (err) {
      show(formatApiError(err), "error");
    } finally {
      setBusy(false);
    }
  }

  function openBillingPortal() {
    // Primary billing is hosted on rootrecord.info (see existing Weather docs).
    try {
      window.open("https://rootrecord.info/account/billing", "_blank", "noopener,noreferrer");
    } catch {
      /* no-op */
    }
  }

  return (
    <>
      <ScreenHeader
        title="Subscription"
        subtitle="Plan, renewal, and payment"
        back={false}
      />
      <PageContainer>
        <Section>
          <div
            data-testid="subscription-plan-card"
            className="p-5 flex items-center gap-4"
          >
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                isPaid
                  ? "bg-brand/15 border border-brand/30 text-brand"
                  : "bg-bg-elevated border border-strong text-ink-secondary"
              }`}
            >
              <Sparkles size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-heading text-lg text-ink-primary">
                {plan === "life"
                  ? "Member access"
                  : plan === "pro"
                  ? "Member"
                  : "Free"}
              </p>
              <p className="text-xs text-ink-secondary">
                Status:{" "}
                <span className="font-mono" data-testid="subscription-status">
                  {user?.subscription_status || "none"}
                </span>
              </p>
            </div>
            <button
              onClick={onRefresh}
              disabled={busy}
              data-testid="subscription-refresh-btn"
              className="btn btn-ghost text-ink-secondary min-h-[40px] px-2"
              aria-label="Refresh entitlement"
            >
              <RefreshCw size={18} className={busy ? "animate-spin" : ""} />
            </button>
          </div>
        </Section>

        <Section title="Manage billing">
          <button
            data-testid="subscription-portal-btn"
            onClick={openBillingPortal}
            className="row w-full text-left hover:bg-bg-elevated"
          >
            <div className="flex items-center gap-3">
              <CreditCard size={18} className="text-brand-light" />
              <div>
                <p className="text-sm font-semibold text-ink-primary">
                  Open billing portal
                </p>
                <p className="text-xs text-ink-tertiary">
                  Manage payment method, invoices, and renewal on rootrecord.info.
                </p>
              </div>
            </div>
            <ExternalLink size={16} className="text-ink-tertiary" />
          </button>
        </Section>

        <p className="text-xs text-ink-tertiary px-2">
          Membership changes made on the web or in another RootRecord app will be
          reflected here after tapping refresh. Lifetime access never expires.
        </p>
      </PageContainer>
      <Toast message={toast.message} kind={toast.kind} onDone={clear} />
    </>
  );
}
