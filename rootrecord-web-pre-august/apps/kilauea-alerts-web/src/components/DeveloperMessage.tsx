import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

type Message = {
  id: string;
  title: string;
  body: string;
  created_at: string;
};

function formatWhen(iso: string | undefined): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

/**
 * "Latest team update" panel for the Kīlauea dashboard. Reads from
 * `/api/mobile/developer-messages?app_id=rootrecord_kilauea_alerts_android` which now
 * returns at most one row. The Discord channel that feeds this is intentionally not
 * mentioned in the UI.
 */
export function DeveloperMessage(): JSX.Element | null {
  const [msg, setMsg] = useState<Message | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(
          "/api/mobile/developer-messages?app_id=rootrecord_kilauea_alerts_android",
          { headers: { Accept: "application/json" } },
        );
        if (!res.ok) {
          if (!cancelled) setErr(`${res.status} ${res.statusText}`);
          return;
        }
        const json = (await res.json()) as { messages?: Message[] };
        const latest = Array.isArray(json.messages) && json.messages.length > 0 ? json.messages[0] : null;
        if (!cancelled) setMsg(latest ?? null);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Could not load update.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return null;
  if (err && !msg) return null;
  if (!msg) return null;

  return (
    <section className="panel" data-testid="developer-message">
      <div className="panel-head">
        <h2>Latest update from the team</h2>
      </div>
      <p className="muted small" style={{ marginTop: 0 }}>{formatWhen(msg.created_at)}</p>
      <p className="modal-prose" style={{ whiteSpace: "pre-wrap" }}>{msg.body}</p>
    </section>
  );
}
