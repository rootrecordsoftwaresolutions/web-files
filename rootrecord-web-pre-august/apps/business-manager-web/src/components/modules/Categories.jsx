import React, { useCallback, useEffect, useRef, useState } from "react";
import { api, formatApiError } from "../../lib/api";
import { CATEGORIES_CHANGED_EVENT } from "../../lib/businessEvents";
import { ScreenHeader, PageContainer, Section, Field, Toast, useToast, Empty, Spinner } from "../ui/Shell";
import { Plus, Trash2 } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { FullSheet } from "../ui/FullSheet";

function emitCategoriesChanged() {
  try {
    window.dispatchEvent(new Event(CATEGORIES_CHANGED_EVENT));
  } catch {
    /* ignore */
  }
}

const DELETE_CONFIRM = "Delete this category?";

export default function Categories() {
  const { guest } = useAuth();
  const { toast, show, clear } = useToast();
  const showRef = useRef(show);
  showRef.current = show;
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#2B8A8F");
  const [editRow, setEditRow] = useState(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("#2B8A8F");
  const [editKind, setEditKind] = useState("time");
  const [editBillable, setEditBillable] = useState(1);
  const [editSaving, setEditSaving] = useState(false);

  const load = useCallback(async () => {
    if (guest) return;
    setLoading(true);
    try {
      const { data } = await api.get("/categories");
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      showRef.current(formatApiError(e), "error");
    } finally {
      setLoading(false);
    }
  }, [guest]);

  useEffect(() => {
    load();
  }, [load]);

  async function add() {
    const n = name.trim();
    if (!n) return show("Name is required", "error");
    try {
      await api.post("/categories", {
        name: n,
        color: color || "#2B8A8F",
        kind: "time",
        billable: 1,
        archived: 0,
        icon: "",
        sort_order: rows.length,
        default_hourly_cents: null,
      });
      setName("");
      setColor("#2B8A8F");
      show("Category added", "success");
      await load();
      emitCategoriesChanged();
    } catch (err) {
      show(formatApiError(err), "error");
    }
  }

  function openEdit(c) {
    setEditRow(c);
    setEditName(c.name || "");
    setEditColor(c.color || "#2B8A8F");
    setEditKind(c.kind === "expense" ? "expense" : "time");
    setEditBillable(Number(c.billable) === 0 ? 0 : 1);
  }

  async function saveEdit(ev) {
    ev.preventDefault();
    if (!editRow) return;
    const n = editName.trim();
    if (!n) return show("Name is required", "error");
    setEditSaving(true);
    try {
      await api.patch(`/categories/${editRow.id}`, {
        name: n,
        color: editColor || "#2B8A8F",
        kind: editKind,
        billable: editBillable,
      });
      show("Category updated", "success");
      setEditRow(null);
      await load();
      emitCategoriesChanged();
    } catch (err) {
      show(formatApiError(err), "error");
    } finally {
      setEditSaving(false);
    }
  }

  async function del(id, label) {
    if (!window.confirm(DELETE_CONFIRM)) return;
    try {
      await api.delete(`/categories/${id}`);
      show(`Deleted “${label}”`, "success");
      await load();
      emitCategoriesChanged();
    } catch (err) {
      show(formatApiError(err), "error");
    }
  }

  return (
    <>
      <ScreenHeader title="Categories" subtitle="Time tracking labels" />
      <PageContainer>
        {guest ? (
          <Empty title="Sign in to manage categories" />
        ) : loading ? (
          <Spinner />
        ) : (
          <>
            <Section title="Add a category">
              {/* Not a <form>: Enter after delete/confirm on mobile was submitting add() with leftover name text. */}
              <div className="p-4">
                <Field label="Name">
                  <input
                    data-testid="categories-new-name"
                    className="input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Client work"
                  />
                </Field>
                <Field label="Color" hint="Shown in charts and lists">
                  <input
                    data-testid="categories-new-color"
                    className="input"
                    type="text"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    placeholder="#2B8A8F"
                  />
                </Field>
                <button type="button" data-testid="categories-add-btn" className="btn btn-primary w-full" onClick={() => void add()}>
                  <Plus size={16} /> Add category
                </button>
                <p className="text-xs text-ink-tertiary mt-3">Add categories to sort your workflow.</p>
              </div>
            </Section>

            <Section title={`Your categories (${rows.length})`}>
              {rows.length === 0 ? (
                <p className="p-4 text-sm text-ink-tertiary text-center">No categories yet.</p>
              ) : (
                rows.map((c) => (
                  <div key={c.id} data-testid={`category-row-${c.id}`} className="row">
                    <button
                      type="button"
                      className="flex items-center gap-3 min-w-0 flex-1 text-left border-0 bg-transparent cursor-pointer p-0"
                      onClick={() => openEdit(c)}
                    >
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color || "#687777" }} aria-hidden />
                      <span className="text-sm font-semibold text-ink-primary truncate">{c.name}</span>
                    </button>
                    <button
                      type="button"
                      data-testid={`category-delete-${c.id}`}
                      onClick={() => del(c.id, c.name)}
                      className="btn btn-ghost p-2 text-ink-tertiary hover:text-expense"
                      aria-label={`Delete ${c.name}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </Section>
          </>
        )}
      </PageContainer>
      <Toast message={toast.message} kind={toast.kind} onDone={clear} />
      <FullSheet open={Boolean(editRow)} title="Edit category" onClose={() => setEditRow(null)}>
        {editRow && (
          <form onSubmit={saveEdit}>
            <Field label="Name">
              <input className="input" value={editName} onChange={(e) => setEditName(e.target.value)} data-testid="category-edit-name" />
            </Field>
            <Field label="Color">
              <input className="input" value={editColor} onChange={(e) => setEditColor(e.target.value)} data-testid="category-edit-color" />
            </Field>
            <Field label="Kind">
              <select className="input" value={editKind} onChange={(e) => setEditKind(e.target.value)} data-testid="category-edit-kind">
                <option value="time">Time</option>
                <option value="expense">Expense</option>
              </select>
            </Field>
            <label className="flex items-center gap-2 mb-4 text-sm text-ink-secondary">
              <input type="checkbox" checked={editBillable === 1} onChange={(e) => setEditBillable(e.target.checked ? 1 : 0)} data-testid="category-edit-billable" />
              Billable
            </label>
            <button type="submit" className="btn btn-primary w-full" disabled={editSaving} data-testid="category-edit-save">
              {editSaving ? "Saving…" : "Save changes"}
            </button>
          </form>
        )}
      </FullSheet>
    </>
  );
}
