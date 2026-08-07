import {
  horseradishComplete,
  PLOT_GINGER,
  PLOT_HORSERADISH,
  ROOT_LEVEL_VEGETABLES,
  userHasStormHazards,
  vegetablesUnlocked,
} from "./tier-catalog";
import type { FarmsStoreData } from "./storeCatalog";
import type { GameSave } from "./types";
import type { VarmintEvent } from "./storeCatalog";

const SAFETY_MS = 24 * 60 * 60 * 1000;

type NudgeAt = { classic?: string; storm?: string };

function loadSeen(scope: string): Set<string> {
  try {
    const raw = localStorage.getItem(`rr-farms-milestones-${scope}`);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveSeen(scope: string, seen: Set<string>): void {
  try {
    localStorage.setItem(`rr-farms-milestones-${scope}`, JSON.stringify([...seen]));
  } catch {
    /* ignore */
  }
}

function loadNudge(scope: string): NudgeAt {
  try {
    const raw = localStorage.getItem(`rr-farms-safety-nudge-${scope}`);
    return raw ? (JSON.parse(raw) as NudgeAt) : {};
  } catch {
    return {};
  }
}

function saveNudge(scope: string, n: NudgeAt): void {
  try {
    localStorage.setItem(`rr-farms-safety-nudge-${scope}`, JSON.stringify(n));
  } catch {
    /* ignore */
  }
}

function canNudge(n: NudgeAt, key: "classic" | "storm"): boolean {
  const at = n[key];
  if (!at) return true;
  const ms = Date.parse(at);
  return !Number.isFinite(ms) || Date.now() - ms >= SAFETY_MS;
}

function hasClassicExposure(save: GameSave): boolean {
  return save.plots.some((p) => p.unlocked && p.rowsActive > 0 && p.id >= 1 && p.id <= 9);
}

export function buildGuestAdvisories(
  scope: string,
  save: GameSave,
  store: FarmsStoreData,
): VarmintEvent[] {
  const seen = loadSeen(scope);
  const nudge = loadNudge(scope);
  const out: VarmintEvent[] = [];
  const now = new Date().toISOString();
  let id = 0;
  const push = (kind: string, message: string, key: string) => {
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ id: `guest-adv-${++id}-${key}`, kind, plot_id: null, message, created_at: now });
  };

  if (userHasStormHazards(save.plots)) {
    push(
      "advisory_milestone_storms",
      "Wind and lightning are now unlocked. They can strike anywhere in your unlocked field. Open Farmhands for storm gear.",
      "danger_storms",
    );
  }
  if (horseradishComplete(save.plots)) {
    push("advisory_milestone_orchards", "Orchards tier unlocked — use the Orchards tab.", "tier_orchards");
  }
  if (vegetablesUnlocked(save.plots)) {
    push(
      "advisory_milestone_vegetables",
      `Farm level ${ROOT_LEVEL_VEGETABLES} — vegetable plots are unlocked.`,
      "tier_vegetables",
    );
  }
  const ginger = save.plots.find((p) => p.id === PLOT_GINGER);
  if (ginger?.unlocked) {
    push(
      "advisory_root_unlock",
      "Ginger unlocked — wind and lightning apply once you have 2+ rows.",
      `root_unlock_${PLOT_GINGER}`,
    );
  }
  const horseradish = save.plots.find((p) => p.id === PLOT_HORSERADISH);
  if (horseradish?.unlocked) {
    push("advisory_root_unlock", "Horseradish unlocked — 10 rows opens orchards.", `root_unlock_${PLOT_HORSERADISH}`);
  }

  if (hasClassicExposure(save)) {
    const missing: string[] = [];
    if (!store.protections.gopher) missing.push("gopher protection");
    if (!store.protections.mice) missing.push("field mice protection");
    if (!store.protections.rabbit) missing.push("rabbit protection");
    if (!store.protections.birds) missing.push("Uncle for birds");
    if (missing.length && canNudge(nudge, "classic")) {
      out.push({
        id: `guest-adv-safety-classic-${Date.now()}`,
        kind: "advisory_safety_classic",
        plot_id: null,
        message: `Buy the needed tool, then turn on ${missing.join(", ")} under Farmhands.`,
        created_at: now,
      });
      nudge.classic = now;
    }
  }

  if (userHasStormHazards(save.plots)) {
    const missing: string[] = [];
    if (!store.lightning_meteorologist) {
      missing.push("lightning meteorologist with a lightning rod");
    }
    if (!store.cypress_trees) missing.push("cypress windbreak");
    if (missing.length && canNudge(nudge, "storm")) {
      out.push({
        id: `guest-adv-safety-storm-${Date.now()}`,
        kind: "advisory_safety_storm",
        plot_id: null,
        message: `Storms active — consider buying the needed tool and turning on ${missing.join(" and ")} on Farmhands.`,
        created_at: now,
      });
      nudge.storm = now;
    }
  }

  saveSeen(scope, seen);
  saveNudge(scope, nudge);
  return out;
}
