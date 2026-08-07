import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { api } from "../../lib/api";
import { ScreenHeader, PageContainer, Section, Field, Empty, Toast, useToast } from "../ui/Shell";
import { EntitySelectWithNew } from "../ui/EntitySelectWithNew";
import { fmtDateShort, durationHours, fmtHours, isoNow } from "../../lib/format";
import { Play, Square, PlusCircle, Zap, Trash2, Plus } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { CATEGORIES_CHANGED_EVENT } from "../../lib/businessEvents";

export default function TimeTracking() {
  const { guest } = useAuth();
  const location = useLocation();
  const { toast, show, clear } = useToast();
  const [session, setSession] = useState(null);
  const [categories, setCategories] = useState([]);
  const [projects, setProjects] = useState([]);
  const [categoryId, setCategoryId] = useState("");
  const [projectId, setProjectId] = useState("");
  /** Once the user picks a category (including "—"), refetches must not override their choice. */
  const categoryTouched = useRef(false);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  // Manual entry
  const [mStart, setMStart] = useState("");
  const [mEnd, setMEnd] = useState("");
  const [mCat, setMCat] = useState("");
  const [mDesc, setMDesc] = useState("");

  // Quick actions
  const [quickActions, setQuickActions] = useState([]);
  const qaAddInFlight = useRef(false);
  const [qaLabel, setQaLabel] = useState("");
  const [qaCat, setQaCat] = useState("");
  const [qaDesc, setQaDesc] = useState("");

  const load = useCallback(async () => {
    if (guest) return;
    try {
      const [s, c, p, q] = await Promise.all([
        api.get("/time/session"),
        api.get("/categories"),
        api.get("/projects"),
        api.get("/quick-actions"),
      ]);
      setSession(s.data?.active ? s.data : null);
      setCategories(Array.isArray(c.data) ? c.data : []);
      setProjects(Array.isArray(p.data) ? p.data : []);
      setQuickActions(Array.isArray(q.data) ? q.data : []);
      const rows = Array.isArray(c.data) ? c.data : [];
      const rowIds = new Set(rows.map((r) => r.id));
      setCategoryId((prev) => {
        if (prev && !rowIds.has(prev)) return "";
        if (categoryTouched.current) return prev;
        if (prev && rowIds.has(prev)) return prev;
        return rows[0]?.id || "";
      });
    } catch {/* ignore */}
  }, [guest]);

  useEffect(() => {
    load();
  }, [load, location.pathname]);

  useEffect(() => {
    if (guest) return undefined;
    const onVis = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [guest, load]);

  useEffect(() => {
    if (guest) return undefined;
    const onCats = () => load();
    window.addEventListener(CATEGORIES_CHANGED_EVENT, onCats);
    return () => window.removeEventListener(CATEGORIES_CHANGED_EVENT, onCats);
  }, [guest, load]);

  async function clockIn() {
    if (guest) return show("Sign in to track time", "error");
    setBusy(true);
    try {
      const { data } = await api.post("/time/clock-in", {
        category_id: categoryId || null,
        project_id: projectId || null,
        description,
      });
      setSession(data);
      show("Clocked in", "success");
    } catch (e) { show("Could not clock in", "error"); }
    finally { setBusy(false); }
  }

  async function clockOut() {
    setBusy(true);
    try {
      await api.post("/time/clock-out", { description });
      setSession(null);
      setDescription("");
      show("Saved time entry", "success");
    } catch (e) { show("Could not clock out", "error"); }
    finally { setBusy(false); }
  }

  async function saveManual() {
    if (guest) return show("Sign in to track time", "error");
    if (!mStart || !mEnd) return show("Pick start and end", "error");
    try {
      await api.post("/time/manual", {
        start_utc: new Date(mStart).toISOString(),
        end_utc: new Date(mEnd).toISOString(),
        category_id: mCat || null,
        description: mDesc,
      });
      setMStart(""); setMEnd(""); setMDesc("");
      show("Manual entry saved", "success");
    } catch { show("Could not save", "error"); }
  }

  async function addQa() {
    if (!qaLabel.trim()) return show("Label required", "error");
    if (qaAddInFlight.current) return;
    qaAddInFlight.current = true;
    try {
      await api.post("/quick-actions", {
        label: qaLabel.trim(),
        category_id: qaCat || null,
        default_description: qaDesc,
        icon: "Zap",
        sort_order: quickActions.length,
      });
      setQaLabel(""); setQaDesc(""); setQaCat("");
      show("Quick action added", "success");
      load();
    } catch {
      show("Could not save", "error");
    } finally {
      qaAddInFlight.current = false;
    }
  }

  async function delQa(id) {
    try {
      await api.delete(`/quick-actions/${id}`);
      load();
    } catch { show("Could not delete", "error"); }
  }

  async function runQa(qa) {
    if (session) return show("Already on the clock", "error");
    try {
      const { data } = await api.post(`/quick-actions/${qa.id}/run`);
      setSession(data);
      show(`Clocked in: ${qa.label}`, "success");
    } catch { show("Could not start", "error"); }
  }

  return (
    <>
      <ScreenHeader title="Time & Tracking" subtitle="Clock in, clock out, or log manually" back={false} />
      <PageContainer>
        {guest ? (
          <Empty title="Sign in to track time" icon={<Play size={32} />}>
            Time entries are tied to your account.
          </Empty>
        ) : (
          <>
            <Section title="Now">
              <div className="p-4">
                <div className="row" style={{ borderBottom: "none", padding: 0, marginBottom: 12 }}>
                  <div>
                    <p className="text-xs text-ink-tertiary">Status</p>
                    <p data-testid="session-status" className="font-heading text-base font-semibold">
                      {session ? "On the clock" : "Off the clock"}
                    </p>
                  </div>
                  {session && (
                    <p className="text-xs text-ink-secondary">
                      Started {fmtDateShort(session.started_at_utc)}<br />
                      <span className="text-brand font-semibold">
                        {fmtHours(durationHours(session.started_at_utc, isoNow()))}
                      </span>
                    </p>
                  )}
                </div>
                {!session && (
                  <>
                    <Field label="Category">
                      <EntitySelectWithNew
                        entityType="category"
                        value={categoryId}
                        onChange={(v) => {
                          categoryTouched.current = true;
                          setCategoryId(v);
                        }}
                        items={categories}
                        allowEmpty
                        emptyLabel="—"
                        dataTestId="track-category"
                        onRefresh={load}
                      />
                    </Field>
                    <Field label="Project (optional)">
                      <EntitySelectWithNew
                        entityType="project"
                        value={projectId}
                        onChange={setProjectId}
                        items={projects}
                        allowEmpty
                        emptyLabel="—"
                        dataTestId="track-project"
                        onRefresh={load}
                      />
                    </Field>
                  </>
                )}
                <Field label="What you are doing">
                  <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Working on…" data-testid="track-description" />
                </Field>
                {session ? (
                  <button type="button" data-testid="clock-out-btn" onClick={clockOut} disabled={busy} className="btn btn-danger w-full">
                    <Square size={18} fill="currentColor" /> Clock out
                  </button>
                ) : (
                  <button type="button" data-testid="clock-in-btn" onClick={clockIn} disabled={busy} className="btn btn-primary w-full">
                    <Play size={18} fill="currentColor" /> Clock in
                  </button>
                )}
              </div>
            </Section>

            <Section title="Quick actions" action={<span className="text-[10px] text-ink-tertiary">One-tap clock-in</span>}>
              <div className="p-3">
                {quickActions.length === 0 ? (
                  <p className="text-sm text-ink-tertiary text-center py-2">No quick actions yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {quickActions.map((qa) => (
                      <div key={qa.id} className="flex items-center gap-1 rounded-xl bg-bg-elevated border border-strong px-1 pl-3">
                        <button
                          type="button"
                          data-testid={`track-qa-run-${qa.id}`}
                          onClick={() => runQa(qa)}
                          disabled={!!session}
                          className="flex items-center gap-2 py-2 pr-2 disabled:opacity-50"
                        >
                          <Zap size={14} className="text-brand" />
                          <span className="text-sm font-semibold">{qa.label}</span>
                        </button>
                        <button type="button" data-testid={`track-qa-del-${qa.id}`} onClick={() => delQa(qa.id)} className="p-2 text-ink-tertiary hover:text-expense">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {/* Not a <form>: implicit submit (Enter / mobile) was firing addQa with a stale label after bulk deletes. */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-subtle">
                  <input data-testid="qa-label" className="input col-span-2" placeholder="Label (e.g. Code)" value={qaLabel} onChange={(e) => setQaLabel(e.target.value)} />
                  <EntitySelectWithNew
                    entityType="category"
                    value={qaCat}
                    onChange={setQaCat}
                    items={categories}
                    allowEmpty
                    emptyLabel="— category —"
                    dataTestId="qa-category"
                    className="input"
                    onRefresh={load}
                  />
                  <input data-testid="qa-desc" className="input" placeholder="Description" value={qaDesc} onChange={(e) => setQaDesc(e.target.value)} />
                  <button type="button" data-testid="qa-add-btn" className="btn btn-secondary col-span-2" onClick={() => void addQa()}>
                    <Plus size={14} /> Add quick action
                  </button>
                </div>
              </div>
            </Section>

            <Section title="Manual time entry">
              <div className="p-4">
                <Field label="Start">
                  <input data-testid="manual-start" className="input" type="datetime-local" value={mStart} onChange={(e) => setMStart(e.target.value)} />
                </Field>
                <Field label="End">
                  <input data-testid="manual-end" className="input" type="datetime-local" value={mEnd} onChange={(e) => setMEnd(e.target.value)} />
                </Field>
                <Field label="Category">
                  <EntitySelectWithNew
                    entityType="category"
                    value={mCat}
                    onChange={setMCat}
                    items={categories}
                    allowEmpty
                    emptyLabel="—"
                    dataTestId="manual-category"
                    onRefresh={load}
                  />
                </Field>
                <Field label="Description">
                  <input className="input" value={mDesc} onChange={(e) => setMDesc(e.target.value)} placeholder="What was this?" data-testid="manual-description" />
                </Field>
                <button type="button" data-testid="manual-save-btn" onClick={saveManual} className="btn btn-secondary w-full">
                  <PlusCircle size={18} /> Save manual entry
                </button>
              </div>
            </Section>
          </>
        )}
      </PageContainer>
      <Toast message={toast.message} kind={toast.kind} onDone={clear} />
    </>
  );
}
