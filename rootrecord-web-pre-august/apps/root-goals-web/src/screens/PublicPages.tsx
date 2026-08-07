import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { AiDisclaimer } from "../components/AiDisclaimer";
import { fetchPublicGoals } from "../lib/api";

export function PublicGoalsListPage() {
  const { address } = useParams<{ address: string }>();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!address) return;
    fetchPublicGoals(address)
      .then((d) => {
        if (d.detail) setError(String(d.detail));
        else setData(d);
      })
      .catch(() => setError("Could not load goals."));
  }, [address]);

  const goals = (data?.goals as Array<Record<string, unknown>>) || [];

  return (
    <div className="app">
      <p className="lead"><a href="https://rootrecord.info">Root Record</a> · Root Goals</p>
      <h1>Public goals</h1>
      <p className="lead mono">{address}</p>
      <AiDisclaimer compact />
      {error && <p className="error">{error}</p>}
      <ul className="goal-list">
        {goals.map((g) => (
          <li key={String(g.slug)}>
            <a href={`/${address}/goals/${g.slug}`}>{String(g.title)}</a>
            {g.ai_summary_text ? <p className="lead">{String(g.ai_summary_text)}</p> : null}
          </li>
        ))}
      </ul>
      {!goals.length && !error && <p className="lead">No public goals.</p>}
    </div>
  );
}

export function PublicGoalDetailPage() {
  const { address, slug } = useParams<{ address: string; slug: string }>();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!address || !slug) return;
    fetchPublicGoals(address, slug)
      .then((d) => {
        if (d.detail) setError(String(d.detail));
        else setData(d);
      })
      .catch(() => setError("Could not load goal."));
  }, [address, slug]);

  const goal = data?.goal as Record<string, unknown> | undefined;
  const plan = goal?.ai_plan as Record<string, unknown> | undefined;
  const steps = (plan?.steps as Array<Record<string, unknown>>) || [];

  return (
    <div className="app">
      <p><a href={`/${address}/goals`}>← All goals</a></p>
      <h1>{goal ? String(goal.title) : "Goal"}</h1>
      <AiDisclaimer compact />
      {error && <p className="error">{error}</p>}
      {goal && (
        <>
          <p className="lead">{String(goal.ai_summary_text || "")}</p>
          <ol>{steps.map((s, i) => <li key={i}>{String(s.title || s.detail)}</li>)}</ol>
        </>
      )}
    </div>
  );
}
