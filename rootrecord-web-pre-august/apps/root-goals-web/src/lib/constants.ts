import pkg from "../../package.json";

/** Shown in footer; kept in sync with bump-and-build-release (package.json + Android versionCode). */
export const APP_VERSION = pkg.version;

/** Play "Release N" — patch segment matches versionCode (e.g. 1.0.8 → 8). */
export const APP_RELEASE = (() => {
  const patch = Number(pkg.version.split(".")[2]);
  return Number.isFinite(patch) ? patch : 0;
})();

export const AI_DISCLAIMER =
  "Root Record does not provide financial support or advice. Actions and Suggestions are AI-generated and may not reflect Root Record's core beliefs. Use your own judgment.";

export type LocalCategory = { id: string; name: string };

export type GoalDraft = {
  title: string;
  category_id: string;
  category_name: string;
  purpose: string;
  requires_money: boolean;
  estimated_cost_cents: number | null;
  user_steps_summary: string;
  min_days: number | null;
  max_days: number | null;
};

export function emptyDraft(): GoalDraft {
  return {
    title: "",
    category_id: "",
    category_name: "",
    purpose: "",
    requires_money: false,
    estimated_cost_cents: null,
    user_steps_summary: "",
    min_days: null,
    max_days: null,
  };
}
