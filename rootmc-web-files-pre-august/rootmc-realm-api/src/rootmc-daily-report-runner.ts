/**
 * Orchestrate daily + category reports without exceeding a single Worker CPU budget.
 */

import {
  ROOTMC_DEDICATED_CHANNEL_CATEGORIES,
  type RootMcDedicatedChannelCategory,
} from "./rootmc-grok-prompts";
import { runRootMcDailyCategoryReport, runRootMcDailyCategoryReports } from "./rootmc-daily-category-reports";
import {
  gatherDailyMetrics,
  previousHstDayKey,
  resolveServerId,
  type RootMcDailyReportEnv,
} from "./rootmc-daily-report";
import { missingDailyCategoryReports } from "./rootmc-ai-report-store";

function str(v: unknown): string {
  return String(v ?? "").trim();
}

export type CategoryReportResult = {
  category: RootMcDedicatedChannelCategory;
  ok: boolean;
  detail?: string;
};

/** Run each category brief inline (shared metrics). HTTP self-fetch caused 522 timeouts. */
export async function runCategoryReportsIsolated(
  env: RootMcDailyReportEnv,
  serverId: string,
  opts?: { awaitResults?: boolean; metrics?: Awaited<ReturnType<typeof gatherDailyMetrics>>; dayKey?: string },
): Promise<CategoryReportResult[]> {
  const awaitResults = opts?.awaitResults !== false;
  const dayKey = str(opts?.dayKey) || previousHstDayKey();

  const runInline = async (): Promise<CategoryReportResult[]> => {
    const metrics = opts?.metrics ?? (await gatherDailyMetrics(env, dayKey, serverId));
    const rows = await runRootMcDailyCategoryReports(env, { serverId, metrics });
    return rows.map((r) => ({ category: r.category, ok: r.ok, detail: r.detail }));
  };

  if (!awaitResults) {
    void runInline().catch((e) => {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("rootmc_daily_category_background_failed", msg.slice(0, 200));
    });
    return ROOTMC_DEDICATED_CHANNEL_CATEGORIES.map((category) => ({
      category,
      ok: true,
      detail: "queued",
    }));
  }

  return runInline();
}

/** Run only category briefs that did not post for the HST day (cron retry path). */
export async function runMissingDailyCategoryReports(
  env: RootMcDailyReportEnv,
  serverId: string,
  dayKey?: string,
  metricsOverride?: Awaited<ReturnType<typeof gatherDailyMetrics>>,
): Promise<CategoryReportResult[]> {
  const dk = str(dayKey) || previousHstDayKey();
  const missing = await missingDailyCategoryReports(env.DB, serverId, dk);
  if (missing.length === 0) {
    return ROOTMC_DEDICATED_CHANNEL_CATEGORIES.map((category) => ({
      category,
      ok: true,
      detail: "already posted",
    }));
  }

  const metrics = metricsOverride ?? (await gatherDailyMetrics(env, dk, serverId));
  const results: CategoryReportResult[] = [];
  for (const category of missing) {
    const r = await runRootMcDailyCategoryReport(env, category, serverId, metrics);
    results.push({ category, ok: r.ok, detail: r.detail });
  }
  for (const category of ROOTMC_DEDICATED_CHANNEL_CATEGORIES) {
    if (missing.includes(category)) continue;
    results.push({ category, ok: true, detail: "already posted" });
  }
  return results;
}

export async function runFullDailyReportSuite(
  env: RootMcDailyReportEnv,
  opts?: { serverId?: string; previewLabel?: string; clearDayKey?: string },
): Promise<{ dayKey: string; daily: { ok: boolean; detail?: string }; categories: CategoryReportResult[] }> {
  const { runRootMcCombinedDailyReport } = await import("./rootmc-daily-combined");
  const serverId = str(opts?.serverId) || (await resolveServerId(env.DB));
  const dayKey = opts?.clearDayKey || previousHstDayKey();

  if (opts?.clearDayKey) {
    await env.DB.prepare(`DELETE FROM rootmc_daily_category_reports WHERE server_id = ? AND day_key = ?`)
      .bind(serverId, dayKey)
      .run();
    await env.DB.prepare(`DELETE FROM rootmc_daily_reports WHERE server_id = ? AND day_key = ?`)
      .bind(serverId, dayKey)
      .run();
  }

  const metrics = await gatherDailyMetrics(env, dayKey, serverId);
  const daily = await runRootMcCombinedDailyReport(env, {
    previewLabel: opts?.previewLabel,
    serverId,
    metrics,
  });
  const categories = await runCategoryReportsIsolated(env, serverId, {
    awaitResults: true,
    metrics,
    dayKey,
  });
  return {
    dayKey,
    daily: { ok: daily.ok, detail: daily.detail },
    categories,
  };
}

export function formatReportSuiteSummary(
  dayKey: string,
  daily: { ok: boolean; detail?: string },
  categories: CategoryReportResult[],
): string {
  const lines = [`**Daily summary** — ${daily.ok ? daily.detail || "posted" : daily.detail || "failed"}`];
  for (const row of categories) {
    const status = row.ok ? row.detail || "posted" : row.detail || "failed";
    lines.push(`**${row.category}** — ${status}`);
  }
  const queued = categories.some((row) => row.detail === "queued");
  if (queued) {
    lines.push("", "_Category briefs are generating in the background (one Grok call each)._");
  }
  return `**Reports** (${dayKey} HST)\n${lines.join("\n")}`;
}
