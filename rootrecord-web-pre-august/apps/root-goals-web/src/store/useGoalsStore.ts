import { create } from "zustand";
import { persist } from "zustand/middleware";

import { emptyDraft, type GoalDraft, type LocalCategory } from "../lib/constants";

type OnboardingStep =
  | "welcome"
  | "title"
  | "category"
  | "addCategory"
  | "purpose"
  | "money"
  | "steps"
  | "timeline"
  | "auth";

type GoalsState = {
  onboardingStep: OnboardingStep;
  draft: GoalDraft;
  localCategories: LocalCategory[];
  costDollars: string;
  setStep: (step: OnboardingStep) => void;
  setDraft: (patch: Partial<GoalDraft>) => void;
  setCostDollars: (v: string) => void;
  addLocalCategory: (cat: LocalCategory) => void;
  setLocalCategories: (cats: LocalCategory[]) => void;
  resetOnboarding: () => void;
  beginNewGoal: () => void;
};

export const useGoalsStore = create<GoalsState>()(
  persist(
    (set) => ({
      onboardingStep: "welcome",
      draft: emptyDraft(),
      localCategories: [],
      costDollars: "",
      setStep: (onboardingStep) => set({ onboardingStep }),
      setDraft: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
      setCostDollars: (costDollars) => set({ costDollars }),
      addLocalCategory: (cat) => set((s) => ({ localCategories: [...s.localCategories, cat] })),
      setLocalCategories: (localCategories) => set({ localCategories }),
      resetOnboarding: () =>
        set({ onboardingStep: "welcome", draft: emptyDraft(), localCategories: [], costDollars: "" }),
      beginNewGoal: () =>
        set({ onboardingStep: "title", draft: emptyDraft(), localCategories: [], costDollars: "" }),
    }),
    { name: "root-goals-v1" },
  ),
);
