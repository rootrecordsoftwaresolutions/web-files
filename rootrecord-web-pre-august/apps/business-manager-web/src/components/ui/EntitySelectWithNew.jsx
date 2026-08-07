import React, { useState, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { api } from "../../lib/api";
import { CATEGORIES_CHANGED_EVENT } from "../../lib/businessEvents";
import { Field } from "./Shell";
import { X } from "lucide-react";

const NEW_VALUE = "__new__";

const DEFAULT_CATEGORY_COLOR = "#2B8A8F";

/**
 * Select for entity ids (category, project, client) with "+ New …" → dialog → POST.
 * There are **no preset/default categories** from the server; each category is created only when
 * the user saves from this dialog or from the Categories screen.
 * When there are zero categories, "+ New" is a **button** (not the last `<select>` option) so mobile
 * WebViews do not fire bogus `change` events.
 */
export function EntitySelectWithNew({
  value,
  onChange,
  items,
  entityType,
  allowEmpty = true,
  emptyLabel = "—",
  className = "input",
  dataTestId,
  disabled,
  onRefresh,
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_CATEGORY_COLOR);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const options = (items || []).map((x) => ({ id: x.id, label: x.label ?? x.name ?? x.display_name ?? "—" }));
  const selectOptionKey = options.map((o) => `${String(o.id)}:${String(o.label)}`).join("|");

  const categoryEmptyButton = entityType === "category" && options.length === 0;

  useEffect(() => {
    const v = value == null ? "" : String(value);
    if (!v || v === NEW_VALUE) return;
    const ids = new Set((items || []).map((x) => String(x.id)));
    if (!ids.has(v)) onChange("");
  }, [value, items, onChange]);

  function resetForm() {
    setName("");
    setColor(DEFAULT_CATEGORY_COLOR);
    setEmail("");
    setPhone("");
    setErr("");
  }

  function openModal() {
    resetForm();
    setOpen(true);
  }

  async function submit(e) {
    e.preventDefault();
    setErr("");
    const n = name.trim();
    if (!n) {
      setErr(entityType === "client" ? "Display name is required." : "Name is required.");
      return;
    }
    setSaving(true);
    try {
      let doc;
      if (entityType === "category") {
        const { data } = await api.post("/categories", {
          name: n,
          color: color || DEFAULT_CATEGORY_COLOR,
          kind: "time",
          billable: 1,
          archived: 0,
          icon: "",
          sort_order: 999,
          default_hourly_cents: null,
        });
        doc = data;
      } else if (entityType === "project") {
        const { data } = await api.post("/projects", { name: n });
        doc = data;
      } else if (entityType === "client") {
        const { data } = await api.post("/clients", {
          display_name: n,
          email: email.trim(),
          phone: phone.trim(),
        });
        doc = data;
      } else {
        throw new Error("Unknown entityType");
      }
      if (doc?.id) onChange(String(doc.id));
      setOpen(false);
      resetForm();
      if (entityType === "category") {
        try {
          window.dispatchEvent(new Event(CATEGORIES_CHANGED_EVENT));
        } catch {
          /* ignore */
        }
      }
      if (onRefresh) await onRefresh();
    } catch (ex) {
      setErr(ex?.response?.data?.detail || ex?.message || "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  const newLabel =
    entityType === "category" ? "+ New category…" : entityType === "project" ? "+ New project…" : "+ New client…";

  const showNewInSelect = entityType !== "category" || options.length > 0;

  return (
    <>
      {categoryEmptyButton ? (
        <button
          type="button"
          key="entity-select-new-category"
          className={className}
          data-testid={dataTestId}
          disabled={disabled}
          onClick={openModal}
        >
          {newLabel}
        </button>
      ) : (
        <select
          key={selectOptionKey}
          className={className}
          data-testid={dataTestId}
          disabled={disabled}
          value={value || ""}
          onChange={(e) => {
            const v = e.target.value;
            if (v === NEW_VALUE) openModal();
            else onChange(v);
          }}
        >
          {allowEmpty && <option value="">{emptyLabel}</option>}
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
          {showNewInSelect && <option value={NEW_VALUE}>{newLabel}</option>}
        </select>
      )}

      <Dialog.Root
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) resetForm();
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-[2px]" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[101] w-[min(92vw,400px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-strong bg-bg-elevated p-4 shadow-xl focus:outline-none">
            <div className="flex items-start justify-between gap-2 mb-3">
              <Dialog.Title className="font-heading text-lg font-bold text-ink-primary pr-6">
                {entityType === "category" && "New category"}
                {entityType === "project" && "New project"}
                {entityType === "client" && "New client"}
              </Dialog.Title>
              <Dialog.Close className="btn btn-ghost p-2 -mr-2 -mt-1 text-ink-tertiary" aria-label="Close">
                <X size={18} />
              </Dialog.Close>
            </div>
            <Dialog.Description className="sr-only">Create a new {entityType} and use it in the form.</Dialog.Description>
            <form onSubmit={submit} className="space-y-3">
              <Field label={entityType === "client" ? "Display name" : "Name"}>
                <input
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={entityType === "client" ? "Acme Corp" : "Name"}
                  autoFocus
                  data-testid={`entity-new-${entityType}-name`}
                />
              </Field>
              {entityType === "category" && (
                <Field label="Color" hint="Hex color for charts and lists">
                  <input
                    className="input"
                    type="text"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    placeholder="#2B8A8F"
                    data-testid="entity-new-category-color"
                  />
                </Field>
              )}
              {entityType === "client" && (
                <>
                  <Field label="Email (optional)">
                    <input
                      className="input"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      data-testid="entity-new-client-email"
                    />
                  </Field>
                  <Field label="Phone (optional)">
                    <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} data-testid="entity-new-client-phone" />
                  </Field>
                </>
              )}
              {err && <p className="text-sm text-[#FB7185]">{err}</p>}
              <div className="flex gap-2 pt-1">
                <Dialog.Close asChild>
                  <button type="button" className="btn btn-secondary flex-1">
                    Cancel
                  </button>
                </Dialog.Close>
                <button type="submit" className="btn btn-primary flex-1" disabled={saving} data-testid={`entity-new-${entityType}-save`}>
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

export { NEW_VALUE };
