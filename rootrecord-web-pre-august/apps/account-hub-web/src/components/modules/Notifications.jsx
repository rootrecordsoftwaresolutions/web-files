import React, { useEffect, useState } from "react";
import { ScreenHeader, PageContainer, Section, Spinner, Toast, useToast } from "../ui/Shell";
import { getPrefs, setPrefs, formatApiError } from "../../lib/api";
import { Bell, Mail, Smartphone } from "lucide-react";

const TOGGLES = [
  {
    key: "push_alerts",
    label: "Push alerts",
    desc: "Weather hazard and account security push notifications.",
    icon: Bell,
    testid: "notifs-toggle-push",
  },
  {
    key: "email_summary",
    label: "Email summaries",
    desc: "Weekly plan and account roll-up.",
    icon: Mail,
    testid: "notifs-toggle-email",
  },
  {
    key: "device_activity",
    label: "New device sign-in alerts",
    desc: "We email you when a new device signs into your account.",
    icon: Smartphone,
    testid: "notifs-toggle-device",
  },
];

export default function Notifications() {
  const { toast, show, clear } = useToast();
  const [prefs, setPrefsState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await getPrefs();
        if (alive) setPrefsState(normalize(data));
      } catch {
        if (alive) setPrefsState(defaults());
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function toggle(key) {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefsState(next);
    setSaving(true);
    try {
      await setPrefs(next);
      show("Preferences saved.", "success");
    } catch (err) {
      // Revert on failure.
      setPrefsState(prefs);
      show(formatApiError(err), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <ScreenHeader
        title="Notifications"
        subtitle="Push, email, and device alerts"
        back={false}
      />
      <PageContainer>
        {loading ? (
          <Spinner />
        ) : (
          <Section title="Preferences">
            {TOGGLES.map((t) => (
              <div key={t.key} className="row">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-bg-elevated text-brand flex items-center justify-center flex-shrink-0">
                    <t.icon size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink-primary">
                      {t.label}
                    </p>
                    <p className="text-xs text-ink-tertiary">{t.desc}</p>
                  </div>
                </div>
                <Switch
                  testid={t.testid}
                  checked={Boolean(prefs?.[t.key])}
                  onChange={() => toggle(t.key)}
                  disabled={saving}
                />
              </div>
            ))}
          </Section>
        )}
        <p className="text-xs text-ink-tertiary px-2">
          Preferences are stored via <span className="font-mono">/api/me/prefs</span>{" "}
          and apply across every RootRecord app signed in with this account.
        </p>
      </PageContainer>
      <Toast message={toast.message} kind={toast.kind} onDone={clear} />
    </>
  );
}

function defaults() {
  return { push_alerts: true, email_summary: false, device_activity: true };
}

function normalize(data) {
  if (!data || typeof data !== "object") return defaults();
  const d = defaults();
  return {
    push_alerts: data.push_alerts ?? data.pushAlerts ?? d.push_alerts,
    email_summary: data.email_summary ?? data.emailSummary ?? d.email_summary,
    device_activity: data.device_activity ?? data.deviceActivity ?? d.device_activity,
  };
}

function Switch({ checked, onChange, disabled, testid }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      data-testid={testid}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
        checked ? "bg-brand" : "bg-bg-elevated border border-strong"
      } disabled:opacity-60`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-ink-primary transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}
