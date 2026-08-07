import React, { useEffect, useState } from "react";
import { api, formatApiError } from "../../lib/api";
import { Field } from "../ui/Shell";
import { FullSheet } from "../ui/FullSheet";
import { EntitySelectWithNew } from "../ui/EntitySelectWithNew";
import { toDatetimeLocalInput } from "../../lib/format";

/**
 * Edit an existing time entry (PATCH /time/entries/:id). Used from Reports, Work Log, etc.
 */
export function TimeEntryEditorSheet({
  open,
  entry,
  categories,
  onClose,
  onSaved,
  showToast,
  /** Called after creating a category from the picker so lists stay fresh */
  onTaxonomyRefresh,
}) {
  const [projects, setProjects] = useState([]);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !entry) return;
    setStart(toDatetimeLocalInput(entry.start_utc));
    setEnd(toDatetimeLocalInput(entry.end_utc));
    setCategoryId(entry.category_id || "");
    setProjectId(entry.project_id || "");
    setDescription(entry.description || "");
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get("/projects");
        if (!cancelled) setProjects(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setProjects([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, entry]);

  async function save(ev) {
    ev.preventDefault();
    if (!entry) return;
    if (!start || !end) {
      showToast("Start and end are required", "error");
      return;
    }
    const sIso = new Date(start).toISOString();
    const eIso = new Date(end).toISOString();
    if (new Date(eIso) <= new Date(sIso)) {
      showToast("End must be after start", "error");
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.patch(`/time/entries/${entry.id}`, {
        start_utc: sIso,
        end_utc: eIso,
        category_id: categoryId || null,
        project_id: projectId || null,
        description: description.trim(),
      });
      showToast("Entry updated", "success");
      onSaved?.(data);
      onClose();
    } catch (err) {
      showToast(formatApiError(err), "error");
    } finally {
      setSaving(false);
    }
  }

  if (!entry) return null;

  return (
    <FullSheet open={open} title="Edit time entry" onClose={onClose}>
      <form onSubmit={save} className="pb-2">
        <Field label="Start">
          <input className="input" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} data-testid="edit-time-start" />
        </Field>
        <Field label="End">
          <input className="input" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} data-testid="edit-time-end" />
        </Field>
        <Field label="Category">
          <EntitySelectWithNew
            entityType="category"
            value={categoryId}
            onChange={setCategoryId}
            items={categories}
            allowEmpty
            emptyLabel="—"
            dataTestId="edit-time-category"
            onRefresh={onTaxonomyRefresh || (() => {})}
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
            dataTestId="edit-time-project"
            onRefresh={async () => {
              const { data } = await api.get("/projects");
              setProjects(Array.isArray(data) ? data : []);
            }}
          />
        </Field>
        <Field label="Description">
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} data-testid="edit-time-desc" />
        </Field>
        <button type="submit" className="btn btn-primary w-full mt-2" disabled={saving} data-testid="edit-time-save">
          {saving ? "Saving…" : "Save changes"}
        </button>
      </form>
    </FullSheet>
  );
}
