import type { ExecutionContext } from "@cloudflare/workers-types";

import { json } from "./cors";
import type { Env } from "./realm-router";
import { handleRequest } from "./realm-router";
import { handleTownyDiscordReconcileCron } from "./discord-rootmc-towny";
import { previousHstDayKey, resolveServerId } from "./rootmc-daily-report";
import { dailyReportSuiteComplete } from "./rootmc-ai-report-store";
import { expireDueProposals, processGrantProposalMajorityHold } from "./rootmc-community-proposals";
import { maybeRunLegislatureCron } from "./rootmc-legislature";
import { evaluateShopPriceAlerts } from "./rootmc-shop-alerts";
import { runRootMcDiscordActivitySync } from "./rootmc-discord-activity-sync";
import { isWeeklyAwardsDue, previousCompletedHstWeekKey } from "./rootmc-hst-week";
import { runWeeklyIntelligenceSuite } from "./rootmc-weekly-report-runner";
import { runRootMcWeeklyActivityAwards, weeklyActivityAwardsPosted } from "./rootmc-weekly-activity-awards";
import { isMonthlyDividendCronSlot, runMonthlyTreasuryDividendCron } from "./rootmc-treasury";
import { runPaperTokenPriceCron } from "./rootmc-paper-token";
import { runMysqlEconomyPullCron } from "./rootmc-mysql-economy-pull";
import { runLiveEconomyStatusPost } from "./rootmc-live-economy-status";

async function maybeRunDailyReports(env: Env, when: Date): Promise<void> {
  const dayKey = previousHstDayKey(when);
  const serverId = await resolveServerId(env.DB);
  if (await dailyReportSuiteComplete(env.DB, serverId, dayKey)) {
    return;
  }

  const { runFullDailyReportSuite, runMissingDailyCategoryReports } = await import(
    "./rootmc-daily-report-runner"
  );
  const { combinedReportPosted } = await import("./rootmc-ai-report-store");

  if (await combinedReportPosted(env.DB, serverId, dayKey)) {
    const categories = await runMissingDailyCategoryReports(env, serverId, dayKey);
    console.log(
      JSON.stringify({
        msg: "rootmc_daily_category_retry",
        dayKey,
        categories: categories.map((c) => `${c.category}:${c.detail}`),
      }),
    );
    return;
  }

  await runFullDailyReportSuite(env);
}

async function maybeRunWeeklyReports(env: Env, when: Date): Promise<void> {
  const weekKey = previousCompletedHstWeekKey(when);
  if (!isWeeklyAwardsDue(weekKey, when)) {
    return;
  }
  if (!(await weeklyActivityAwardsPosted(env.DB, weekKey))) {
    console.log(JSON.stringify({ msg: "rootmc_weekly_awards_start", weekKey }));
    const active = await runRootMcWeeklyActivityAwards(env, weekKey);
    console.log(JSON.stringify({ msg: "rootmc_weekly_awards_done", weekKey, detail: active.detail }));
  }
  await runWeeklyIntelligenceSuite(env, weekKey);
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      return await handleRequest(request, env, ctx);
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      console.error("http_request_uncaught", detail.slice(0, 800));
      return json({ detail: "Internal Server Error" }, 500);
    }
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const when = new Date(event.scheduledTime || Date.now());
    ctx.waitUntil(handleTownyDiscordReconcileCron(env));
    ctx.waitUntil(expireDueProposals(env).catch((e) => console.warn("rootmc_proposals_expire", e)));
    ctx.waitUntil(
      processGrantProposalMajorityHold(env).catch((e) => console.warn("rootmc_grant_majority", e)),
    );
    ctx.waitUntil(maybeRunLegislatureCron(env, when).catch((e) => console.warn("rootmc_legislature_cron", e)));
    ctx.waitUntil(
      evaluateShopPriceAlerts(env).catch((e) =>
        console.warn("rootmc_shop_alerts_cron", e instanceof Error ? e.message : String(e)),
      ),
    );
    ctx.waitUntil(
      runRootMcDiscordActivitySync(env).catch((e) =>
        console.warn("rootmc_discord_activity_sync", e instanceof Error ? e.message : String(e)),
      ),
    );
    ctx.waitUntil(
      runPaperTokenPriceCron(env).catch((e) =>
        console.warn("rootmc_paper_token_cron", e instanceof Error ? e.message : String(e)),
      ),
    );
    ctx.waitUntil(
      runMysqlEconomyPullCron(env).catch((e) =>
        console.warn("rootmc_mysql_economy_pull", e instanceof Error ? e.message : String(e)),
      ),
    );
    // Retry every 10 min until the prior HST day's suite is in D1 (reports often take >1h).
    ctx.waitUntil(
      maybeRunDailyReports(env, when).catch((e) =>
        console.error("rootmc_daily_reports_failed", e instanceof Error ? e.message : String(e)),
      ),
    );
    if (when.getUTCHours() === 10) {
      // Monthly Activity Dividend Discord report disabled — no public dividend metrics.
    }
    // Retry every 10 min after Sunday 08:00 HST until weekly awards are in D1.
    ctx.waitUntil(
      maybeRunWeeklyReports(env, when).catch((e) =>
        console.error("rootmc_weekly_reports_failed", e instanceof Error ? e.message : String(e)),
      ),
    );
    if (isMonthlyDividendCronSlot(when)) {
      ctx.waitUntil(
        runMonthlyTreasuryDividendCron(env).catch((e) =>
          console.error("rootmc_treasury_dividend_failed", e instanceof Error ? e.message : String(e)),
        ),
      );
    }
    if (event.cron === "0 * * * *") {
      ctx.waitUntil(
        runLiveEconomyStatusPost(env)
          .then((result) =>
            console.log(
              JSON.stringify({
                msg: "rootmc_live_economy_status",
                ok: result.ok,
                detail: result.detail,
              }),
            ),
          )
          .catch((e) =>
            console.error(
              "rootmc_live_economy_status_failed",
              e instanceof Error ? e.message : String(e),
            ),
          ),
      );
    }
  },
};
