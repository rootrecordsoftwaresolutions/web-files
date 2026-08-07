import React, { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { ScreenHeader, PageContainer, Section, Field, Empty, Toast, useToast } from "../ui/Shell";
import { EntitySelectWithNew } from "../ui/EntitySelectWithNew";
import { fmtDateShort, toDatetimeLocalInput } from "../../lib/format";
import { Plus, Trash2 } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { FullSheet } from "../ui/FullSheet";
import { formatApiError } from "../../lib/api";

export default function Schedule() {
  const { guest } = useAuth();
  const [items, setItems] = useState([]);
  const [clients, setClients] = useState([]);
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [clientId, setClientId] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("scheduled");
  const { toast, show, clear } = useToast();
  const [editEv, setEditEv] = useState(null);
  const [evTitle, setEvTitle] = useState("");
  const [evStart, setEvStart] = useState("");
  const [evEnd, setEvEnd] = useState("");
  const [evClient, setEvClient] = useState("");
  const [evNotes, setEvNotes] = useState("");
  const [evStatus, setEvStatus] = useState("scheduled");
  const [evSaving, setEvSaving] = useState(false);

  async function load() {
    if (guest) return;
    const [{ data: e }, { data: c }] = await Promise.all([api.get("/schedule"), api.get("/clients")]);
    setItems(e); setClients(c);
  }
  useEffect(() => { load(); }, [guest]); // eslint-disable-line

  async function add(e) {
    e.preventDefault();
    if (!title.trim() || !start) return show("Title and start required", "error");
    await api.post("/schedule", {
      title, starts_at_utc: new Date(start).toISOString(),
      ends_at_utc: end ? new Date(end).toISOString() : null,
      client_id: clientId || null, notes, status,
    });
    setTitle(""); setStart(""); setEnd(""); setNotes(""); setClientId(""); setStatus("scheduled");
    show("Event saved", "success"); load();
  }
  async function del(id) { await api.delete(`/schedule/${id}`); load(); }

  function openEditEvent(ev) {
    setEditEv(ev);
    setEvTitle(ev.title || "");
    setEvStart(toDatetimeLocalInput(ev.starts_at_utc));
    setEvEnd(ev.ends_at_utc ? toDatetimeLocalInput(ev.ends_at_utc) : "");
    setEvClient(ev.client_id || "");
    setEvNotes(ev.notes || "");
    setEvStatus(ev.status || "scheduled");
  }

  async function saveEventEdit(e) {
    e.preventDefault();
    if (!editEv || !evTitle.trim() || !evStart) return show("Title and start required", "error");
    setEvSaving(true);
    try {
      await api.patch(`/schedule/${editEv.id}`, {
        title: evTitle.trim(),
        starts_at_utc: new Date(evStart).toISOString(),
        ends_at_utc: evEnd ? new Date(evEnd).toISOString() : null,
        client_id: evClient || null,
        notes: evNotes,
        status: evStatus,
      });
      show("Event updated", "success");
      setEditEv(null);
      load();
    } catch (err) {
      show(formatApiError(err), "error");
    } finally {
      setEvSaving(false);
    }
  }

  return (
    <>
      <ScreenHeader title="Schedule & Bookings" subtitle="Create events and review the next 90 days" back={false} />
      <PageContainer>
        {guest ? (
          <Empty title="Sign in to use Schedule & Bookings" />
        ) : (
          <>
            <Section title="New event">
              <form onSubmit={add} className="p-4">
                <Field label="Title"><input data-testid="event-title" className="input" value={title} onChange={(e)=>setTitle(e.target.value)} /></Field>
                <Field label="Starts"><input data-testid="event-start" className="input" type="datetime-local" value={start} onChange={(e)=>setStart(e.target.value)} /></Field>
                <Field label="Ends (optional)"><input data-testid="event-end" className="input" type="datetime-local" value={end} onChange={(e)=>setEnd(e.target.value)} /></Field>
                <Field label="Client (optional)">
                  <EntitySelectWithNew
                    entityType="client"
                    value={clientId}
                    onChange={setClientId}
                    items={clients}
                    allowEmpty
                    emptyLabel="—"
                    dataTestId="event-client"
                    onRefresh={load}
                  />
                </Field>
                <Field label="Status">
                  <select data-testid="event-status" className="input" value={status} onChange={(e)=>setStatus(e.target.value)}>
                    <option value="scheduled">Scheduled</option>
                    <option value="done">Done</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </Field>
                <Field label="Notes"><textarea data-testid="event-notes" className="input min-h-[80px] py-3" rows={3} value={notes} onChange={(e)=>setNotes(e.target.value)} /></Field>
                <button data-testid="event-add-btn" className="btn btn-primary w-full"><Plus size={16} /> Save event</button>
              </form>
            </Section>

            <Section title={`Upcoming (${items.length})`}>
              {items.length === 0 ? <p className="p-4 text-sm text-ink-tertiary">No events yet.</p> :
                items.map((ev) => (
                  <div key={ev.id} data-testid={`event-row-${ev.id}`} className="row">
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left border-0 bg-transparent cursor-pointer p-0"
                      onClick={() => openEditEvent(ev)}
                    >
                      <p className="text-sm truncate font-semibold">{ev.title}</p>
                      <p className="text-xs text-ink-tertiary">
                        {fmtDateShort(ev.starts_at_utc)}
                        {ev.ends_at_utc && ` → ${fmtDateShort(ev.ends_at_utc)}`}
                        {" · "}
                        {ev.status}
                      </p>
                    </button>
                    <button type="button" onClick={() => del(ev.id)} className="btn btn-ghost p-2 text-ink-tertiary">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
            </Section>
          </>
        )}
      </PageContainer>
      <Toast message={toast.message} kind={toast.kind} onDone={clear} />
      <FullSheet open={Boolean(editEv)} title="Edit event" onClose={() => setEditEv(null)}>
        {editEv && (
          <form onSubmit={saveEventEdit}>
            <Field label="Title">
              <input className="input" value={evTitle} onChange={(e) => setEvTitle(e.target.value)} data-testid="edit-event-title" />
            </Field>
            <Field label="Starts">
              <input className="input" type="datetime-local" value={evStart} onChange={(e) => setEvStart(e.target.value)} data-testid="edit-event-start" />
            </Field>
            <Field label="Ends (optional)">
              <input className="input" type="datetime-local" value={evEnd} onChange={(e) => setEvEnd(e.target.value)} data-testid="edit-event-end" />
            </Field>
            <Field label="Client (optional)">
              <EntitySelectWithNew
                entityType="client"
                value={evClient}
                onChange={setEvClient}
                items={clients}
                allowEmpty
                emptyLabel="—"
                dataTestId="edit-event-client"
                onRefresh={load}
              />
            </Field>
            <Field label="Status">
              <select className="input" value={evStatus} onChange={(e) => setEvStatus(e.target.value)} data-testid="edit-event-status">
                <option value="scheduled">Scheduled</option>
                <option value="done">Done</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </Field>
            <Field label="Notes">
              <textarea className="input min-h-[80px] py-3" rows={3} value={evNotes} onChange={(e) => setEvNotes(e.target.value)} data-testid="edit-event-notes" />
            </Field>
            <button type="submit" className="btn btn-primary w-full" disabled={evSaving} data-testid="edit-event-save">
              {evSaving ? "Saving…" : "Save changes"}
            </button>
          </form>
        )}
      </FullSheet>
    </>
  );
}
