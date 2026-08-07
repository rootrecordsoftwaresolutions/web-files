import React, { useState } from "react";
import { ScreenHeader, PageContainer, Section, Field, Toast, useToast } from "../ui/Shell";
import { api, formatApiError, RR_APP_ID } from "../../lib/api";

export default function Feedback() {
  const [type, setType] = useState("general");
  const [msg, setMsg] = useState("");
  const [reply, setReply] = useState("");
  const [diag, setDiag] = useState(true);
  const { toast, show, clear } = useToast();

  async function send(e) {
    e.preventDefault();
    if (!msg.trim()) return show("Tell us something first", "error");
    try {
      await api.post("/feedback", {
        type,
        message: msg,
        reply_email: reply || null,
        include_diagnostics: diag,
        app_id: RR_APP_ID,
      });
    } catch (err) {
      show(formatApiError(err), "error");
      return;
    }
    setMsg("");
    setReply("");
    show("Feedback sent — thank you", "success");
  }

  return (
    <>
      <ScreenHeader title="Feedback" subtitle="Goes to the team via Discord" />
      <PageContainer>
        <Section>
          <form onSubmit={send} className="p-4">
            <Field label="Type">
              <select
                data-testid="feedback-type"
                className="input"
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
                className="input min-h-[140px] py-3"
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                placeholder="Describe what happened or what you would like…"
              />
            </Field>
            <Field label="Reply-to email (optional)">
              <input
                data-testid="feedback-email"
                className="input"
                type="email"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="you@example.com"
              />
            </Field>
            <label className="flex items-center justify-between gap-3 py-2">
              <span className="text-sm text-ink-secondary">Include app version and OS</span>
              <input
                data-testid="feedback-diag"
                type="checkbox"
                checked={diag}
                onChange={(e) => setDiag(e.target.checked)}
                className="w-5 h-5 accent-[var(--brand)]"
              />
            </label>
            <button data-testid="feedback-send-btn" type="submit" className="btn btn-primary w-full mt-2">
              Send feedback
            </button>
          </form>
        </Section>
      </PageContainer>
      <Toast message={toast.message} kind={toast.kind} onDone={clear} />
    </>
  );
}
