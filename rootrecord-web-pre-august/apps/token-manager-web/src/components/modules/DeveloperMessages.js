import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { listDeveloperMessages, formatRrApiError } from "../../lib/rrApi";

function formatWhen(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export default function DeveloperMessages() {
  const nav = useNavigate();
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setErr("");
      setLoading(true);
      try {
        const { data } = await listDeveloperMessages();
        if (!cancelled) setItems(Array.isArray(data?.messages) ? data.messages : []);
      } catch (e) {
        if (!cancelled) setErr(formatRrApiError(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="page-shell pb-24" data-testid="developer-messages-page">
      <header
        className="sticky top-0 z-20 backdrop-blur-xl bg-bg-base/75 border-b border-white/5"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="px-4 py-3 flex items-center gap-2">
          <button
            type="button"
            className="btn btn-ghost p-2 -ml-2"
            onClick={() => nav(-1)}
            aria-label="Back"
            data-testid="developer-messages-back"
          >
            <ChevronLeft size={22} />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-ink-primary truncate">Developer messages</h1>
            <p className="text-[11px] text-ink-tertiary uppercase tracking-widest truncate">Notes from the RootRecord team</p>
          </div>
        </div>
      </header>
      <div className="px-4 pt-2 space-y-3">
        {loading && <p className="text-sm text-ink-tertiary">Loading…</p>}
        {err && !loading && <div className="card p-4 text-sm text-red-200">{err}</div>}
        {!loading && !err && items.length === 0 && (
          <p className="text-sm text-ink-tertiary">No messages yet. Check back after updates.</p>
        )}
        {/* API returns at most one row (most recent). No per-message title — older synced rows
            had a "Discord · author" prefix we no longer want to surface. */}
        {items[0] && (
          <div key={items[0].id} className="card p-4" data-testid={`developer-message-${items[0].id}`}>
            <div className="text-[11px] text-ink-tertiary font-mono mb-2">{formatWhen(items[0].created_at)}</div>
            <div className="text-sm text-ink-secondary whitespace-pre-wrap leading-relaxed">{items[0].body}</div>
          </div>
        )}
      </div>
    </div>
  );
}
