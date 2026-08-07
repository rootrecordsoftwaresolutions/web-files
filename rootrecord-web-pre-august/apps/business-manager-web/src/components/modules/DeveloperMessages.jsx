import React, { useEffect, useState } from "react";
import { ScreenHeader, PageContainer, Section, Spinner } from "../ui/Shell";
import { listDeveloperMessages } from "../../lib/api";

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
        if (!cancelled) setErr(String(e?.response?.data?.detail || e?.message || "Could not load messages."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <ScreenHeader title="Developer messages" subtitle="Recent notes from the RootRecord team" />
      <PageContainer data-testid="developer-messages-page">
        {loading && <Spinner />}
        {err && !loading && (
          <Section>
            <div className="p-4 text-sm text-[#FB7185]">{err}</div>
          </Section>
        )}
        {!loading && !err && items.length === 0 && (
          <Section>
            <div className="p-4 text-sm text-ink-secondary">No messages yet. Check back after updates.</div>
          </Section>
        )}
        {/* API returns at most one row (most recent). No per-message title — older synced rows
            had a "Discord · author" prefix we no longer want to surface. */}
        {!loading && !err && items[0] && (
          <Section key={items[0].id}>
            <div className="p-4" data-testid={`developer-message-${items[0].id}`}>
              {/* Match Weather Manager's developer-message styling: brand-green text at 60% (timestamp)
                  and 90% (body). Business and Weather share the same green hex (`#5ee9b0`); business
                  exposes it as `brand`, weather as `accent`. */}
              <p className="text-[10px] font-mono text-brand/60 mb-2">{formatWhen(items[0].created_at)}</p>
              <p className="text-sm text-brand/90 whitespace-pre-wrap leading-relaxed">{items[0].body}</p>
            </div>
          </Section>
        )}
      </PageContainer>
    </>
  );
}
