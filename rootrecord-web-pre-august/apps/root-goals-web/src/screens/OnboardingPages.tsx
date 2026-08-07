import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { AiDisclaimer } from "../components/AiDisclaimer";
import { AppFooter } from "../components/AppFooter";
import { OnboardingNav } from "../components/OnboardingNav";
import {
  createCategory,
  estimateCompletionDate,
  finalizeOnboarding,
  isLoggedIn,
  loadDraft,
  login,
  saveDraft,
  signup,
} from "../lib/api";
import { useGoalsStore } from "../store/useGoalsStore";

export function OnboardingPage() {
  const navigate = useNavigate();
  const { onboardingStep, draft, localCategories, costDollars, setStep, setDraft, setCostDollars, addLocalCategory, resetOnboarding } =
    useGoalsStore();
  const [error, setError] = useState("");
  const [authMode, setAuthMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");

  useEffect(() => {
    if (isLoggedIn() && onboardingStep === "welcome") {
      navigate("/home", { replace: true });
      return;
    }
    loadDraft().then((d) => {
      if (d && d.title) setDraft(d as Partial<typeof draft>);
    });
  }, [setDraft, navigate, onboardingStep]);

  const persist = async (next = draft) => {
    try {
      await saveDraft({
        ...next,
        estimated_cost_cents: costDollars ? Math.round(parseFloat(costDollars) * 100) : null,
      });
    } catch {
      /* offline ok */
    }
  };

  const estDate = estimateCompletionDate(draft.min_days, draft.max_days);

  const goBackOnboarding = () => {
    if (onboardingStep === "title" && isLoggedIn()) {
      navigate("/home");
      return;
    }
    if (onboardingStep === "addCategory") setStep("category");
    else if (onboardingStep === "category") setStep("title");
    else if (onboardingStep === "purpose") setStep("category");
    else if (onboardingStep === "money") setStep("purpose");
    else if (onboardingStep === "steps") setStep("money");
    else if (onboardingStep === "timeline") setStep("steps");
    else if (onboardingStep === "auth") setStep("timeline");
    else if (onboardingStep === "title") setStep("welcome");
    else navigate("/");
  };

  if (onboardingStep === "welcome") {
    return (
      <div className="app">
        <h1>Hello!</h1>
        <p className="lead">Let&apos;s get you on your way to knocking out your goals.</p>
        <div className="btn-row">
          <button type="button" className="primary" onClick={() => setStep("title")}>
            Next
          </button>
          <button type="button" className="secondary" onClick={() => navigate(isLoggedIn() ? "/home" : "/auth")}>
            I already did this
          </button>
        </div>
        <AppFooter />
      </div>
    );
  }

  if (onboardingStep === "title") {
    return (
      <div className="app">
        <OnboardingNav onBack={goBackOnboarding} />
        <h1>What should we call your first goal?</h1>
        <input value={draft.title} onChange={(e) => setDraft({ title: e.target.value })} placeholder="e.g. Pay off my truck" autoFocus />
        <div className="btn-row">
          <button
            type="button"
            className="primary"
            disabled={!draft.title.trim()}
            onClick={() => {
              persist();
              setStep("category");
            }}
          >
            Next
          </button>
        </div>
        <AppFooter />
      </div>
    );
  }

  if (onboardingStep === "addCategory") {
    return (
      <div className="app">
        <OnboardingNav onBack={goBackOnboarding} />
        <h1>Add a category</h1>
        <p className="lead">Categories help you group goals. Create your first one here.</p>
        <input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="Category name" />
        <div className="btn-row">
          <button
            type="button"
            className="primary"
            disabled={!newCategoryName.trim()}
            onClick={() => {
              const cat = { id: `local-${crypto.randomUUID().slice(0, 8)}`, name: newCategoryName.trim() };
              addLocalCategory(cat);
              setDraft({ category_id: cat.id, category_name: cat.name });
              persist({ ...draft, category_id: cat.id, category_name: cat.name });
              setNewCategoryName("");
              setStep("category");
            }}
          >
            Save category
          </button>
          <button type="button" className="secondary" onClick={() => setStep("category")}>
            Cancel
          </button>
        </div>
        <AppFooter />
      </div>
    );
  }

  if (onboardingStep === "category") {
    const cats = localCategories;
    return (
      <div className="app">
        <OnboardingNav onBack={goBackOnboarding} />
        <h1>What category should this be?</h1>
        <select
          value={draft.category_id}
          onChange={(e) => {
            const id = e.target.value;
            const name = cats.find((c) => c.id === id)?.name || "";
            setDraft({ category_id: id, category_name: name });
          }}
        >
          <option value="">Select a category</option>
          {cats.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button type="button" className="secondary" onClick={() => setStep("addCategory")}>
          + Add Category
        </button>
        <div className="btn-row">
          <button
            type="button"
            className="primary"
            disabled={!draft.category_id}
            onClick={() => {
              persist();
              setStep("purpose");
            }}
          >
            Next
          </button>
        </div>
        <AppFooter />
      </div>
    );
  }

  if (onboardingStep === "purpose") {
    return (
      <div className="app">
        <OnboardingNav onBack={goBackOnboarding} />
        <h1>What is the outcome of this goal?</h1>
        <p className="lead">Private to you until you share a goal publicly. Describe the outcome, not internal release notes.</p>
        <textarea
          value={draft.purpose}
          onChange={(e) => setDraft({ purpose: e.target.value })}
          placeholder="e.g. Ship a beta players can use to track personal goals"
        />
        <div className="btn-row">
          <button type="button" className="primary" disabled={!draft.purpose.trim()} onClick={() => { persist(); setStep("money"); }}>
            Next
          </button>
        </div>
        <AppFooter />
      </div>
    );
  }

  if (onboardingStep === "money") {
    return (
      <div className="app">
        <OnboardingNav onBack={goBackOnboarding} />
        <h1>Does this goal require money?</h1>
        <label>
          <input type="checkbox" checked={draft.requires_money} onChange={(e) => setDraft({ requires_money: e.target.checked })} /> Yes, I expect to spend money
        </label>
        {draft.requires_money && (
          <>
            <label>Estimated cost (USD)</label>
            <input type="number" min="0" step="0.01" value={costDollars} onChange={(e) => setCostDollars(e.target.value)} />
          </>
        )}
        <div className="btn-row">
          <button type="button" className="primary" onClick={() => { persist(); setStep("steps"); }}>
            Next
          </button>
        </div>
        <AppFooter />
      </div>
    );
  }

  if (onboardingStep === "steps") {
    return (
      <div className="app">
        <OnboardingNav onBack={goBackOnboarding} />
        <h1>Describe the steps to achieve this goal</h1>
        <p className="lead">Include as much detail as you can.</p>
        <textarea value={draft.user_steps_summary} onChange={(e) => setDraft({ user_steps_summary: e.target.value })} />
        <div className="btn-row">
          <button type="button" className="primary" disabled={!draft.user_steps_summary.trim()} onClick={() => { persist(); setStep("timeline"); }}>
            Next
          </button>
        </div>
        <AppFooter />
      </div>
    );
  }

  if (onboardingStep === "timeline") {
    return (
      <div className="app">
        <OnboardingNav onBack={goBackOnboarding} />
        <h1>When would you like this goal to be completed?</h1>
        <label>Minimum days from today</label>
        <input type="number" min="0" value={draft.min_days ?? ""} onChange={(e) => setDraft({ min_days: e.target.value ? Number(e.target.value) : null })} />
        <label>Maximum days from today</label>
        <input type="number" min="0" value={draft.max_days ?? ""} onChange={(e) => setDraft({ max_days: e.target.value ? Number(e.target.value) : null })} />
        {estDate && <p className="est-date">Estimated completion: {estDate}</p>}
        <div className="btn-row">
          <button type="button" className="primary" onClick={async () => { await persist(); setStep("auth"); }}>
            Next
          </button>
        </div>
        <AppFooter />
      </div>
    );
  }

  if (onboardingStep === "auth") {
    return (
      <div className="app">
        <OnboardingNav onBack={goBackOnboarding} />
        <h1>Create an account to continue</h1>
        <p className="lead">Your answers are saved. Sign in or create a Root Record account to generate your Goal Plan.</p>
        <AiDisclaimer compact />
        <div className="btn-row" style={{ marginBottom: "1rem" }}>
          <button type="button" className={authMode === "signup" ? "primary" : "secondary"} onClick={() => setAuthMode("signup")}>
            Sign up
          </button>
          <button type="button" className={authMode === "login" ? "primary" : "secondary"} onClick={() => setAuthMode("login")}>
            Sign in
          </button>
        </div>
        <label>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <label>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <div className="btn-row">
          <button
            type="button"
            className="primary"
            disabled={!email.trim() || password.length < 8}
            onClick={async () => {
              setError("");
              try {
                if (authMode === "signup") await signup(email.trim(), password);
                else await login(email.trim(), password);
                let categoryId = draft.category_id;
                if (categoryId.startsWith("local-") && draft.category_name) {
                  const cat = await createCategory(draft.category_name);
                  categoryId = cat.id;
                }
                const payload = {
                  ...draft,
                  category_id: categoryId,
                  estimated_cost_cents: costDollars ? Math.round(parseFloat(costDollars) * 100) : null,
                };
                navigate("/generating", { state: { draft: payload } });
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              }
            }}
          >
            {authMode === "signup" ? "Create account & generate plan" : "Sign in & generate plan"}
          </button>
        </div>
        {error && <p className="error">{error}</p>}
        <AppFooter />
      </div>
    );
  }

  return null;
}

export function AuthPage() {
  const navigate = useNavigate();
  const [authMode, setAuthMode] = useState<"signup" | "login">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  return (
    <div className="app">
      <OnboardingNav onBack={() => navigate("/")} />
      <h1>Welcome back</h1>
      <p className="lead">Sign in to view your goals.</p>
      <div className="btn-row" style={{ marginBottom: "1rem" }}>
        <button type="button" className={authMode === "login" ? "primary" : "secondary"} onClick={() => setAuthMode("login")}>
          Sign in
        </button>
        <button type="button" className={authMode === "signup" ? "primary" : "secondary"} onClick={() => setAuthMode("signup")}>
          Sign up
        </button>
      </div>
      <label>Email</label>
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <label>Password</label>
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <div className="btn-row">
        <button
          type="button"
          className="primary"
          disabled={!email.trim() || password.length < 8}
          onClick={async () => {
            setError("");
            try {
              if (authMode === "signup") await signup(email.trim(), password);
              else await login(email.trim(), password);
              navigate("/home");
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            }
          }}
        >
          Continue
        </button>
        <Link to="/" className="secondary btn-link">
          New goal
        </Link>
      </div>
      {error && <p className="error">{error}</p>}
      <AppFooter />
    </div>
  );
}

export function GeneratingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const draft = (location.state as { draft?: Record<string, unknown> } | null)?.draft;
  const { resetOnboarding } = useGoalsStore();

  useEffect(() => {
    if (!draft) {
      navigate("/");
      return;
    }
    finalizeOnboarding(draft)
      .then((res) => {
        resetOnboarding();
        const goal = res.goal as Record<string, unknown>;
        navigate(goal?.id ? `/goals/${goal.id}` : "/home", { replace: true });
      })
      .catch((e) => {
        navigate("/onboarding", { state: { error: e instanceof Error ? e.message : String(e) } });
      });
  }, [draft, navigate, resetOnboarding]);

  return (
    <div className="app generating">
      <div className="spinner" aria-hidden />
      <h2>Generating Goal Plan</h2>
      <p className="lead">We are saving your answers and building a detailed plan…</p>
    </div>
  );
}
