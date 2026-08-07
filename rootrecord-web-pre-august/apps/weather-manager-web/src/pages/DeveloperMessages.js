import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { listDeveloperMessages } from '../lib/api';

function formatWhen(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export default function DeveloperMessages() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setErr('');
      setLoading(true);
      try {
        const { data } = await listDeveloperMessages();
        if (!cancelled) setItems(Array.isArray(data?.messages) ? data.messages : []);
      } catch (e) {
        if (!cancelled) setErr(e?.response?.data?.detail || e?.message || 'Could not load messages.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-app pb-8" data-testid="developer-messages-page">
      <header
        className="flex items-center gap-3 p-4 border-b border-subtle"
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 rounded-sm text-accent hover:bg-containerHover"
          aria-label="Back"
          data-testid="developer-messages-back"
        >
          <ArrowLeft strokeWidth={1.5} className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Developer messages</h1>
          <p className="text-[10px] font-mono uppercase tracking-widest text-accent/70">Recent notes from the team</p>
        </div>
      </header>

      <div className="px-4 pt-4">
        {loading && <p className="text-sm text-accent/70">Loading…</p>}
        {err && !loading && (
          <div className="text-sm bg-sev-severe/10 border border-sev-severe/40 text-sev-severe p-3 rounded-sm">{err}</div>
        )}
        {!loading && !err && items.length === 0 && (
          <p className="text-sm text-accent/70">No messages yet. Check back after updates.</p>
        )}
        {/* API returns the single most recent row; render exactly that — no per-message title
            (older synced rows had a "Discord · author" prefix we no longer want to surface). */}
        {items[0] && (
          <div
            key={items[0].id}
            className="bg-container border border-subtle rounded-sm p-4 mt-2"
            data-testid={`developer-message-${items[0].id}`}
          >
            <div className="text-[10px] font-mono text-accent/60 mb-2">{formatWhen(items[0].created_at)}</div>
            <div className="text-sm text-accent/90 whitespace-pre-wrap leading-relaxed">{items[0].body}</div>
          </div>
        )}
      </div>
    </div>
  );
}
