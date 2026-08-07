import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send } from 'lucide-react';
import { api, RR_APP_ID, isBackendConfigured } from '../lib/api';

function Field({ label, children }) {
  return (
    <label className="block mb-4">
      <span className="text-[10px] font-mono uppercase tracking-widest text-accent/80 block mb-1.5">{label}</span>
      {children}
    </label>
  );
}

export default function Feedback() {
  const navigate = useNavigate();
  const [type, setType] = useState('general');
  const [msg, setMsg] = useState('');
  const [reply, setReply] = useState('');
  const [diag, setDiag] = useState(true);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState({ kind: '', text: '' });

  async function send(e) {
    e.preventDefault();
    if (!msg.trim()) {
      setBanner({ kind: 'err', text: 'Tell us something first.' });
      return;
    }
    if (!isBackendConfigured()) {
      setBanner({ kind: 'err', text: 'Server address is not configured.' });
      return;
    }
    setBusy(true);
    setBanner({ kind: '', text: '' });
    try {
      await api.sendFeedback({
        type,
        message: msg,
        reply_email: reply || null,
        include_diagnostics: diag,
        app_id: RR_APP_ID,
      });
      setMsg('');
      setReply('');
      setBanner({ kind: 'ok', text: 'Feedback sent — thank you.' });
    } catch (err) {
      const d = err?.response?.data?.detail;
      const line =
        typeof d === 'string' && d
          ? d
          : err?.message || 'Could not send. Try again when you have a connection.';
      setBanner({ kind: 'err', text: line });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-app text-white pb-8">
      <header
        className="sticky top-0 z-20 bg-app/95 backdrop-blur border-b border-subtle flex items-center gap-2 px-3 py-3"
        style={{ paddingTop: '0.75rem' }}
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg hover:bg-containerHover text-accent"
          aria-label="Back"
          data-testid="feedback-back"
        >
          <ArrowLeft strokeWidth={1.5} className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold tracking-tight">Feedback</h1>
          <p className="text-[10px] font-mono text-accent/70 uppercase tracking-widest">Delivered to the team</p>
        </div>
        <Send strokeWidth={1.5} className="w-5 h-5 text-accent/50 shrink-0" aria-hidden />
      </header>

      <div className="px-4 pt-4 max-w-lg mx-auto">
        {banner.text && (
          <div
            role="status"
            data-testid="feedback-banner"
            className={`mb-4 text-sm p-3 rounded-lg border ${
              banner.kind === 'ok'
                ? 'bg-emerald-950/40 border-emerald-700/50 text-emerald-100'
                : 'bg-sev-severe/10 border-sev-severe/40 text-sev-moderate'
            }`}
          >
            {banner.text}
          </div>
        )}

        <form onSubmit={send} className="bg-container border border-subtle rounded-xl p-4">
          <Field label="Type">
            <select
              data-testid="feedback-type"
              className="w-full bg-app border border-subtle rounded-lg px-3 py-2.5 text-sm text-white"
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
              className="w-full bg-app border border-subtle rounded-lg px-3 py-2.5 text-sm text-white min-h-[140px] resize-y"
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              placeholder="Describe what happened or what you would like…"
            />
          </Field>
          <Field label="Reply-to email (optional)">
            <input
              data-testid="feedback-email"
              type="email"
              className="w-full bg-app border border-subtle rounded-lg px-3 py-2.5 text-sm text-white"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="you@example.com"
            />
          </Field>
          <label className="flex items-center justify-between gap-3 py-2 mb-4">
            <span className="text-xs text-accent/80">Include app version and OS</span>
            <input
              data-testid="feedback-diag"
              type="checkbox"
              checked={diag}
              onChange={(e) => setDiag(e.target.checked)}
              className="w-5 h-5 accent-[var(--accent,#2dd4bf)]"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            data-testid="feedback-send-btn"
            className="w-full py-3 rounded-lg bg-accent text-app font-semibold text-sm disabled:opacity-50"
          >
            {busy ? 'Sending…' : 'Send feedback'}
          </button>
        </form>

        <p className="text-center text-[10px] font-mono text-accent/60 mt-8">Root Record Weather Manager Mobile · v1.0.12</p>
      </div>
    </div>
  );
}
