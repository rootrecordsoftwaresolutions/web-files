import { useCallback, useEffect, useState } from "react";

import { Link, useNavigate, useParams } from "react-router-dom";



import { AiDisclaimer } from "../components/AiDisclaimer";

import {

  addAchievement,

  addEntry,

  deleteAction,

  deleteSuggestion,

  getGoal,

  isLoggedIn,

  listGoals,

  patchAchievement,

  patchGoal,

  refreshGoalAi,

} from "../lib/api";

import { recordNativeAdAction } from "../lib/nativeAds";
import { notifyGoalsSessionStart } from "../lib/sessionNotify";

function withAdAction<T extends (...args: never[]) => unknown>(fn: T): T {

  return ((...args: Parameters<T>) => {

    recordNativeAdAction();

    return fn(...args);

  }) as T;

}



export function GoalsHomePage() {

  const navigate = useNavigate();

  const [goals, setGoals] = useState<Array<Record<string, unknown>>>([]);

  const [limits, setLimits] = useState<Record<string, unknown>>({});

  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoggedIn()) return;
    notifyGoalsSessionStart();
  }, []);

  const load = useCallback(async () => {

    if (!isLoggedIn()) {

      navigate("/auth");

      return;

    }

    try {

      const res = await listGoals();

      setGoals(res.goals);

      setLimits(res.limits);

    } catch (e) {

      setError(e instanceof Error ? e.message : String(e));

    }

  }, [navigate]);



  useEffect(() => {

    load();

  }, [load]);



  return (

    <div className="page-shell page-shell--nested">

      <header className="page-header">

        <h1>Your goals</h1>

        <p className="lead">Track achievements, notes, and costs as you progress.</p>

        {limits.max_goals != null && (

          <div className="meta-row">

            <span className="meta-pill meta-pill--accent">

              {String(limits.active ?? goals.length)} / {String(limits.max_goals)} goals

            </span>

          </div>

        )}

      </header>



      <main className="page-body">

        {error && <p className="error">{error}</p>}



        {goals.length > 0 ? (

          <div className="goal-grid">

            {goals.map((g) => (

              <Link key={String(g.id)} to={`/goals/${g.id}`} className="goal-card">

                <p className="goal-card__title">{String(g.title)}</p>

                {g.target_date_est ? (

                  <p className="goal-card__meta">Target ~ {String(g.target_date_est)}</p>

                ) : (

                  <p className="goal-card__meta">Open goal</p>

                )}

              </Link>

            ))}

          </div>

        ) : (

          !error && (

            <div className="section-card">

              <p className="empty-state">No goals yet. Add your first goal to get an AI plan, actions, and suggestions.</p>

            </div>

          )

        )}

      </main>



    </div>

  );

}



export function GoalDetailPage() {

  const { id } = useParams<{ id: string }>();

  const navigate = useNavigate();

  const [data, setData] = useState<Record<string, unknown> | null>(null);

  const [error, setError] = useState("");

  const [refreshing, setRefreshing] = useState(false);

  const [achTitle, setAchTitle] = useState("");

  const [noteBody, setNoteBody] = useState("");



  const load = useCallback(async () => {

    if (!id || !isLoggedIn()) return;

    try {

      setData(await getGoal(id));

    } catch (e) {

      setError(e instanceof Error ? e.message : String(e));

    }

  }, [id]);



  useEffect(() => {

    if (!isLoggedIn()) navigate("/auth");

    else load();

  }, [load, navigate]);



  if (!data) {

    return (

      <div className="page-shell page-shell--nested">

        <p className="lead">Loading…</p>

      </div>

    );

  }



  const goal = data.goal as Record<string, unknown>;

  const actions = (data.actions as Array<Record<string, unknown>>) || [];

  const suggestions = (data.suggestions as Array<Record<string, unknown>>) || [];

  const achievements = (data.achievements as Array<Record<string, unknown>>) || [];

  const entries = (data.entries as Array<Record<string, unknown>>) || [];

  const plan = goal.ai_plan as Record<string, unknown> | null;

  const steps = (plan?.steps as Array<Record<string, unknown>>) || [];

  const aiFailed =
    goal.ai_ok === false ||
    String(goal.ai_summary_text || "").includes("could not be generated") ||
    String(goal.ai_summary_text || "").includes("could not be parsed");

  const aiErrorDetail = goal.ai_error_detail ? String(goal.ai_error_detail) : "";



  const refreshAi = async () => {
    setRefreshing(true);
    setError("");
    recordNativeAdAction();
    try {
      const updated = await refreshGoalAi(String(id));
      setData((prev) => ({
        ...(prev || {}),
        goal: updated.goal,
        actions: updated.actions ?? (prev?.actions as Array<Record<string, unknown>>),
        suggestions: updated.suggestions ?? (prev?.suggestions as Array<Record<string, unknown>>),
        achievements: prev?.achievements,
        entries: prev?.entries,
        disclaimer: updated.disclaimer ?? prev?.disclaimer,
        limits: prev?.limits,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRefreshing(false);
    }
  };



  return (

    <div className="page-shell page-shell--nested">

      <header className="page-header">

        <h1>{String(goal.title)}</h1>

        {goal.target_date_est ? (

          <div className="meta-row">

            <span className="meta-pill meta-pill--accent">Target ~ {String(goal.target_date_est)}</span>

          </div>

        ) : null}

      </header>



      <main className="page-body">

        {goal.purpose ? (
          <section className="section-card">
            <h2>Your description</h2>
            <p className="lead" style={{ margin: 0 }}>
              {String(goal.purpose)}
            </p>
            <p className="empty-state" style={{ marginTop: "0.5rem" }}>
              Private unless you enable public sharing — shared pages show title and AI plan only.
            </p>
          </section>
        ) : null}

        {aiFailed ? (

          <div className="card card--warn">

            <strong>AI plan unavailable</strong>

            <p>

              {String(goal.ai_summary_text || "We could not generate your plan.")}

              {aiErrorDetail ? ` (${aiErrorDetail})` : ""}

            </p>

          </div>

        ) : goal.ai_summary_text ? (

          <div className="card">

            <strong>Plan summary</strong>

            <p className="lead" style={{ marginTop: "0.5rem" }}>

              {String(goal.ai_summary_text)}

            </p>

          </div>

        ) : null}



        <AiDisclaimer />



        <section className="section-card">

          <h2>

            Actions <span className="tag">AI</span>

          </h2>

          {actions.length > 0 ? (

            <ul className="item-list">

              {actions.map((a) => (

                <li key={String(a.id)}>

                  <strong>{String(a.title)}</strong>

                  {a.detail ? <p className="lead">{String(a.detail)}</p> : null}

                  <div className="btn-row">

                    <button

                      type="button"

                      className="secondary"

                      onClick={withAdAction(async () => {

                        await deleteAction(String(id), String(a.id));

                        load();

                      })}

                    >

                      Delete

                    </button>

                  </div>

                </li>

              ))}

            </ul>

          ) : (

            <p className="empty-state">

              {aiFailed ? "No actions yet. Refresh the AI plan to generate next steps." : "No actions yet."}

            </p>

          )}

        </section>



        <section className="section-card">

          <h2>

            Suggestions <span className="tag">AI</span>

          </h2>

          {suggestions.length > 0 ? (

            <ul className="item-list">

              {suggestions.map((s) => (

                <li key={String(s.id)}>

                  <strong>{String(s.title)}</strong>

                  {s.detail ? <p className="lead">{String(s.detail)}</p> : null}

                  <div className="btn-row">

                    <button

                      type="button"

                      className="secondary"

                      onClick={withAdAction(async () => {

                        await deleteSuggestion(String(id), String(s.id));

                        load();

                      })}

                    >

                      Delete

                    </button>

                  </div>

                </li>

              ))}

            </ul>

          ) : (

            <p className="empty-state">

              {aiFailed ? "No suggestions yet. Refresh the AI plan to get ideas." : "No suggestions yet."}

            </p>

          )}

        </section>



        {steps.length > 0 && (

          <section className="section-card">

            <h2>Steps</h2>

            <ol>

              {steps.map((s, i) => (

                <li key={i}>{String(s.title || s.detail)}</li>

              ))}

            </ol>

          </section>

        )}



        <section className="section-card">

          <h2>Achievements</h2>

          {achievements.length > 0 ? (

            <ul className="item-list">

              {achievements.map((a) => (

                <li key={String(a.id)}>

                  <label className="achievement-row">

                    <input

                      type="checkbox"

                      checked={Boolean(a.completed_at)}

                      onChange={withAdAction(async (e: React.ChangeEvent<HTMLInputElement>) => {

                        await patchAchievement(String(id), String(a.id), { completed: e.target.checked });

                        load();

                      })}

                    />

                    {String(a.title)}

                  </label>

                </li>

              ))}

            </ul>

          ) : (

            <p className="empty-state">Track milestones as you make progress.</p>

          )}

          <div className="inline-form">

            <input value={achTitle} onChange={(e) => setAchTitle(e.target.value)} placeholder="New achievement" />

            <button

              type="button"

              className="secondary"

              disabled={!achTitle.trim()}

              onClick={withAdAction(async () => {

                await addAchievement(String(id), achTitle.trim());

                setAchTitle("");

                load();

              })}

            >

              Add

            </button>

          </div>

        </section>



        <section className="section-card">

          <h2>Notes</h2>

          <div className="inline-form">

            <textarea value={noteBody} onChange={(e) => setNoteBody(e.target.value)} placeholder="Add a note" />

            <button

              type="button"

              className="secondary"

              disabled={!noteBody.trim()}

              onClick={withAdAction(async () => {

                await addEntry(String(id), "note", noteBody.trim());

                setNoteBody("");

                load();

              })}

            >

              Save note

            </button>

          </div>

          {entries.length > 0 ? (

            <ul className="item-list">

              {entries.map((e) => (

                <li key={String(e.id)}>

                  <span className="tag">{String(e.kind)}</span> {String(e.body)}

                </li>

              ))}

            </ul>

          ) : (

            <p className="empty-state">Notes you add here help future AI refreshes.</p>

          )}

        </section>



        {error && <p className="error">{error}</p>}

      </main>



      <footer className="page-footer">

        <div className="btn-row btn-row--sticky">

          <button type="button" className="primary" disabled={refreshing} onClick={refreshAi}>

            {refreshing ? "Refreshing…" : aiFailed ? "Retry AI plan" : "Refresh AI plan"}

          </button>

          <button

            type="button"

            className="secondary"

            onClick={withAdAction(async () => {

              await patchGoal(String(id), { public_enabled: !goal.public_enabled });

              load();

            })}

          >

            {goal.public_enabled ? "Make private" : "Share publicly"}

          </button>

        </div>

      </footer>

    </div>

  );

}


