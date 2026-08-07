import React, { useState, useEffect, useCallback } from "react";
import { ScreenHeader, PageContainer, Section, Field, Toast, useToast } from "../ui/Shell";
import { api, formatApiError, getDeviceId, setToken } from "../../lib/api";
import { fmtRelative } from "../../lib/format";
import {
  KeyRound,
  Smartphone,
  AlertTriangle,
  RefreshCw,
  LogOut,
  Trash2,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";

export default function Security() {
  const { logout, refresh } = useAuth();
  const { toast, show, clear } = useToast();
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const { data } = await api.get("/me/sessions");
      setSessions(Array.isArray(data) ? data : []);
    } catch {
      setSessions([]);
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  async function submitPassword(e) {
    e.preventDefault();
    if (newPw.length < 6) {
      show("New password must be at least 6 characters.", "error");
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.post("/me/password", {
        current_password: currentPw,
        new_password: newPw,
        device_id: getDeviceId(),
      });
      setCurrentPw("");
      setNewPw("");
      const tok = data?.access_token || data?.token;
      if (tok) {
        setToken(tok);
        await refresh();
      }
      show("Password updated.", "success");
      await loadSessions();
    } catch (err) {
      show(formatApiError(err), "error");
    } finally {
      setBusy(false);
    }
  }

  async function signOutAllDevices() {
    setBusy(true);
    try {
      const { data } = await api.post("/auth/logout", { all_devices: true });
      const n = data?.revoked;
      show(
        typeof n === "number"
          ? `Signed out of ${n} session${n === 1 ? "" : "s"}.`
          : "Signed out of all devices.",
        "success"
      );
      setTimeout(() => {
        logout();
      }, 600);
    } catch (err) {
      show(formatApiError(err), "error");
    } finally {
      setBusy(false);
    }
  }

  async function revokeSession(id) {
    setBusy(true);
    try {
      await api.post(`/me/sessions/${encodeURIComponent(id)}/revoke`);
      show("Session revoked.", "success");
      await loadSessions();
    } catch (err) {
      show(formatApiError(err), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <ScreenHeader
        title="Security"
        subtitle="Password, sessions, and device trust"
        back={false}
      />
      <PageContainer>
        <Section title="Change password">
          <form onSubmit={submitPassword} className="p-4">
            <Field label="Current password">
              <input
                data-testid="security-current-pw"
                className="input"
                type="password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                autoComplete="current-password"
              />
            </Field>
            <Field
              label="New password"
              hint="At least 6 characters. Use a unique password you don't reuse elsewhere."
            >
              <input
                data-testid="security-new-pw"
                className="input"
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                autoComplete="new-password"
              />
            </Field>
            <button
              data-testid="security-update-pw-btn"
              type="submit"
              disabled={busy}
              className="btn btn-primary w-full"
            >
              <KeyRound size={16} /> Update password
            </button>
            <p className="text-[11px] text-ink-tertiary mt-3">
              Calls <span className="font-mono">POST /api/me/password</span> on the primary API.
              You stay signed in on this device when a new token is returned.
            </p>
          </form>
        </Section>

        <Section title="Active sessions">
          {sessionsLoading ? (
            <p className="p-4 text-sm text-ink-tertiary">Loading sessions…</p>
          ) : sessions.length === 0 ? (
            <p className="p-4 text-sm text-ink-tertiary">
              No session history yet. Sign out and sign in again to attach this device to a trackable
              session.
            </p>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {sessions.map((s) => (
                <li key={s.id} className="p-4 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-bg-elevated text-ink-secondary flex items-center justify-center shrink-0">
                    <Smartphone size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink-primary">
                      {s.device_id ? (
                        <span className="font-mono text-xs">{s.device_id.slice(0, 8)}…</span>
                      ) : (
                        "Web / unknown device"
                      )}
                    </p>
                    <p className="text-xs text-ink-tertiary mt-0.5">
                      Last active {fmtRelative(s.last_seen_at)} · IP {s.ip || "—"}
                    </p>
                    {s.user_agent ? (
                      <p className="text-[11px] text-ink-tertiary truncate mt-1" title={s.user_agent}>
                        {s.user_agent}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {s.current ? (
                      <span className="chip" data-testid="session-current-chip" data-active="true">
                        Current
                      </span>
                    ) : s.revoked ? (
                      <span className="chip opacity-60">Revoked</span>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-ghost text-xs min-h-[36px] px-2"
                        disabled={busy}
                        onClick={() => revokeSession(s.id)}
                        title="Revoke this session"
                      >
                        <Trash2 size={14} className="text-[#FB7185]" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="row">
            <div className="flex items-center gap-2 text-ink-secondary text-sm">
              <RefreshCw size={14} /> Refresh
            </div>
            <button
              data-testid="session-refresh-btn"
              onClick={() => loadSessions()}
              disabled={sessionsLoading || busy}
              className="btn btn-ghost text-sm min-h-[40px]"
            >
              Reload
            </button>
          </div>
        </Section>

        <Section title="Dangerous">
          <button
            data-testid="security-signout-all-btn"
            onClick={signOutAllDevices}
            disabled={busy}
            className="row w-full text-left hover:bg-bg-elevated"
          >
            <div className="flex items-center gap-3">
              <LogOut size={18} className="text-[#FB7185]" />
              <span className="text-sm font-semibold text-[#FB7185]">
                Sign out of all devices
              </span>
            </div>
            <AlertTriangle size={16} className="text-[#FB7185]" />
          </button>
        </Section>
      </PageContainer>
      <Toast message={toast.message} kind={toast.kind} onDone={clear} />
    </>
  );
}
