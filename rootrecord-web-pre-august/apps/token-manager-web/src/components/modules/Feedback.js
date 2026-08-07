import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Send } from "lucide-react";
import { sendFeedback, formatRrApiError, RR_APP_ID } from "../../lib/rrApi";
import { useAuth } from "../../contexts/AuthContext";

function Field({ label, children }) {
  return (
    <label className="block mb-4">
      <span className="text-[10px] font-mono uppercase tracking-widest text-ink-tertiary block mb-1.5">{label}</span>
      {children}
    </label>
  );
}

export default function Feedback() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [type, setType] = useState("general");
  const [msg, setMsg] = useState("");
  const [reply, setReply] = useState("");
  const [diag, setDiag] = useState(true);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState({ kind: "", text: "" });

  async function send(e) {
    e.preventDefault();
    if (!user) {
      setBanner({ kind: "err", text: "Sign in to send feedback." });
      return;
    }
    if (!msg.trim()) {
      setBanner({ kind: "err", text: "Tell us something first." });
      return;
    }
    setBusy(true);
    setBanner({ kind: "", text: "" });
    try {
      await sendFeedback({
        type,
        message: msg,
        reply_email: reply || null,
        include_diagnostics: diag,
        app_id: RR_APP_ID,
      });
      setMsg("");
      setReply("");
      setBanner({ kind: "ok", text: "Feedback sent — thank you." });
    } catch (err) {
      setBanner({ kind: "err", text: formatRrApiError(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-shell pb-24" data-testid="feedback-page">
      <header
        className="sticky top-0 z-20 backdrop-blur-xl bg-bg-base/75 border-b border-white/5"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="px-4 py-3 flex items-center gap-2">
          <button
            type="button"
            className="btn btn-ghost p-2 -ml-2"
            onClick={() => nav("/settings")}
            aria-label="Back"
            data-testid="feedback-back"
          >
            <ChevronLeft size={22} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-ink-primary truncate">Feedback</h1>
            <p className="text-[11px] text-ink-tertiary uppercase tracking-widest truncate">Delivered to the team</p>
          </div>
          <Send size={20} className="text-phos/60 shrink-0" aria-hidden />
        </div>
      </header>

      <div className="px-4 pt-4 max-w-lg mx-auto">
        {banner.text && (
          <div
            role="status"
            data-testid="feedback-banner"
            className={`mb-4 text-sm p-3 rounded-xl border ${
              banner.kind === "ok"
                ? "bg-emerald-950/40 border-emerald-700/50 text-emerald-100"
                : "bg-red-950/30 border-red-800/50 text-red-200"
            }`}
          >
            {banner.text}
          </div>
        )}

        <form onSubmit={send} className="card p-4">
          <Field label="Type">
            <select
              data-testid="feedback-type"
              className="w-full bg-bg-elevated border border-white/10 rounded-lg px-3 py-2.5 text-sm text-ink-primary"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="general">General</option>
              <option value="bug">Bug report</option>
              <option value="feature">Feature request</option>
              <option value="billing">Billing / account</option>
            </select>
          </Field>
          <Field label="Your feedback">
            <textarea
              data-testid="feedback-message"
              className="w-full bg-bg-elevated border border-white/10 rounded-lg px-3 py-2.5 text-sm text-ink-primary min-h-[140px]"
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              placeholder="Describe what happened or what you would like…"
            />
          </Field>
          <Field label="Reply-to email (optional)">
            <input
              data-testid="feedback-email"
              className="w-full bg-bg-elevated border border-white/10 rounded-lg px-3 py-2.5 text-sm text-ink-primary"
              type="email"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="you@example.com"
            />
          </Field>
          <label className="flex items-center justify-between gap-3 py-2 mb-4">
            <span className="text-sm text-ink-secondary">Include app version and OS</span>
            <input
              data-testid="feedback-diag"
              type="checkbox"
              checked={diag}
              onChange={(e) => setDiag(e.target.checked)}
              className="w-5 h-5 accent-phos"
            />
          </label>
          <button data-testid="feedback-send-btn" type="submit" className="btn btn-primary w-full" disabled={busy}>
            {busy ? "Sending…" : "Send feedback"}
          </button>
        </form>
      </div>
    </div>
  );
}
