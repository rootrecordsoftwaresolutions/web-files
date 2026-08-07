import React, { useEffect, useState } from "react";
import PageHeader from "../ui/PageHeader";
import { useWallet } from "../../contexts/WalletContext";
import { useToast } from "../ui/Toast";
import { createContact, deleteContact, formatApiError, listContacts } from "../../lib/api";
import { isValidPubkey } from "../../lib/solana";
import { shortAddr } from "../../lib/format";
import { Trash2, Plus, BookUser } from "lucide-react";

export default function AddressBook() {
  const { pubkey } = useWallet();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [label, setLabel] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const { data } = await listContacts(pubkey);
      setItems(data || []);
    } catch (e) { toast.error(formatApiError(e)); }
  };

  useEffect(() => { load(); }, [pubkey]); // eslint-disable-line react-hooks/exhaustive-deps

  const onAdd = async (e) => {
    e.preventDefault();
    if (!label.trim()) return toast.error("Give this contact a label.");
    if (!isValidPubkey(address.trim())) return toast.error("Address is not a valid Solana public key.");
    setBusy(true);
    try {
      await createContact(pubkey, { label: label.trim(), address: address.trim(), note: note.trim() });
      setLabel(""); setAddress(""); setNote("");
      toast.success("Contact saved");
      await load();
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setBusy(false); }
  };

  const onDelete = async (id) => {
    try {
      await deleteContact(pubkey, id);
      await load();
      toast.info("Removed");
    } catch (e) { toast.error(formatApiError(e)); }
  };

  return (
    <div className="page-shell" data-testid="address-book-screen">
      <PageHeader title="Address book" subtitle="Save recipients for quick send" />
      <div className="px-4 pt-4 space-y-4">
        <form onSubmit={onAdd} className="card p-4 space-y-3" data-testid="contact-form">
          <div>
            <label className="label" htmlFor="c-label">Label</label>
            <input id="c-label" className="input" value={label} onChange={(e) => setLabel(e.target.value)}
                   placeholder="e.g. Trading wallet" data-testid="contact-label-input" />
          </div>
          <div>
            <label className="label" htmlFor="c-address">Address</label>
            <input id="c-address" className="input mono text-[13px]" value={address}
                   onChange={(e) => setAddress(e.target.value)} placeholder="Solana public key"
                   autoCapitalize="none" autoCorrect="off" spellCheck={false} data-testid="contact-address-input" />
          </div>
          <div>
            <label className="label" htmlFor="c-note">Note (optional)</label>
            <input id="c-note" className="input" value={note} onChange={(e) => setNote(e.target.value)}
                   placeholder="Short memo" data-testid="contact-note-input" />
          </div>
          <button type="submit" disabled={busy} className="btn btn-primary w-full" data-testid="contact-add-btn">
            <Plus size={16} /> {busy ? "Saving…" : "Save contact"}
          </button>
        </form>

        <div className="space-y-2" data-testid="contacts-list">
          {items.length === 0 ? (
            <div className="card p-6 text-center" data-testid="contacts-empty">
              <BookUser size={28} className="mx-auto text-ink-tertiary" />
              <div className="mt-2 font-heading font-semibold text-ink-primary">No saved contacts</div>
              <div className="text-sm text-ink-secondary mt-1">Save addresses you send to often.</div>
            </div>
          ) : items.map((c) => (
            <div key={c.id} className="card p-3 flex items-center gap-3" data-testid={`contact-${c.id}`}>
              <div className="w-9 h-9 rounded-lg bg-phos/15 border border-phos/30 text-phos flex items-center justify-center mono text-sm font-bold">
                {c.label?.[0]?.toUpperCase() || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-ink-primary truncate">{c.label}</div>
                <div className="mono text-[11px] text-ink-tertiary truncate">{shortAddr(c.address, 6, 6)}</div>
                {c.note && <div className="text-[11px] text-ink-secondary mt-0.5 truncate">{c.note}</div>}
              </div>
              <button
                className="p-2 rounded-lg hover:bg-rose/10 text-ink-tertiary hover:text-rose transition-colors"
                onClick={() => onDelete(c.id)}
                aria-label="Delete contact"
                data-testid={`contact-delete-${c.id}`}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
