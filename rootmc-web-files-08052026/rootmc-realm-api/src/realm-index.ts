import type { ExecutionContext } from "@cloudflare/workers-types";

import { json } from "./cors";
import type { Env } from "./realm-router";
import { handleRequest } from "./realm-router";
import { previousHstDayKey, resolveServerId, isHstMidnightHour } from "./rootmc-daily-report";
import { latestCombinedReportDayKey } from "./rootmc-ai-report-store";
import { expireDueProposals, processGrantProposalMajorityHold } from "./rootmc-community-proposals";
import { maybeRunLegislatureCron } from "./rootmc-legislature";
import { evaluateShopPriceAlerts } from "./rootmc-shop-alerts";
import { runRootMcDiscordActivitySync } from "./rootmc-discord-activity-sync";
import { isWeeklyAwardsDue, isWeeklyReportCronSlot, previousCompletedHstWeekKey } from "./rootmc-hst-week";
import { runWeeklyIntelligenceSuite } from "./rootmc-weekly-report-runner";
import { runRootMcWeeklyActivityAwards, weeklyActivityAwardsPosted } from "./rootmc-weekly-activity-awards";
import { isMonthlyDividendCronSlot, runMonthlyTreasuryDividendCron } from "./rootmc-treasury";
import { runMysqlFullSyncCron } from "./rootmc-mysql-full-sync";
import { runMysqlEconomyPullCron } from "./rootmc-mysql-economy-pull";
import { runLiveEconomyStatusPost } from "./rootmc-live-economy-status";
import { runWebstatPullCron } from "./rootmc-webstat";
import { runDevWorkstationTimeoutCron } from "./rootmc-dev-workstation";
import { runHostPresenceMaintenance } from "./rootmc-host-presence";
import { isG2Worker } from "./g2/g2-db";
import { withPublicCacheHeaders } from "./public-cache";
import { maybeAttachResponseSignature } from "./rootmc-cache-sign";
import { runConnectionPreferenceWatchdogCron } from "./rootmc-connection-preference";

async function maybeRunDailyReports(env: Env, when: Date): Promise<void> {
  const throughDayKey = previousHstDayKey(when);
  const serverId = await resolveServerId(env.DB);

  const { runFullDailyReportSuite, runMissingDailyCategoryReports } = await import(
    "./rootmc-daily-report-runner"
  );
  const {
    combinedReportPosted,
    resolveDailyReportDayKey,
    resolveOldestIncompleteCategoryDayKey,
  } = await import("./rootmc-ai-report-store");

  // Prefer combined #daily-summary catch-up — one suite per tick (Grok is slow).
  const dayKey = await resolveDailyReportDayKey(env.DB, serverId, throughDayKey);
  if (dayKey && !(await combinedReportPosted(env.DB, serverId, dayKey))) {
    await runFullDailyReportSuite(env, { serverId, dayKey });
    return;
  }

  const categoryDayKey = await resolveOldestIncompleteCategoryDayKey(env.DB, serverId, throughDayKey);
  if (categoryDayKey) {
    const categories = await runMissingDailyCategoryReports(env, serverId, categoryDayKey, undefined, {
      limit: 1,
    });
    console.log(
      JSON.stringify({
        msg: "rootmc_daily_category_retry",
        dayKey: categoryDayKey,
        categories: categories.map((c) => `${c.category}:${c.detail}`),
      }),
    );
  }
}

async function maybeRunWeeklyReports(env: Env, when: Date): Promise<void> {
  // Sunday 08:xx HST only (18:xx UTC). Never run on weekday midnight — it shares
  // economy/towns/nations channels with the daily suite and will overwrite them.
  if (!isWeeklyReportCronSlot(when)) {
    return;
  }
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
  try {
    const { refreshAutomatedReportsBoard } = await import("./rootmc-automated-reports-board");
    const board = await refreshAutomatedReportsBoard(env);
    console.log("rootmc_reports_board", board.detail);
  } catch (e) {
    console.warn("rootmc_reports_board_failed", e instanceof Error ? e.message : String(e));
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const url = new URL(request.url);
      let response = await handleRequest(request, env, ctx);
      response = await withPublicCacheHeaders(request, response, url.pathname);
      response = await maybeAttachResponseSignature(response, env);
      return response;
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      console.error("http_request_uncaught", detail.slice(0, 800));
      return json({ detail: "Internal Server Error" }, 500);
    }
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const when = new Date(event.scheduledTime || Date.now());

    // Gen 2 worker: no standalone Discord posts. Gen 1 hourly cron fetches
    // POST /api/v2/cron/hourly-discord for Gen2 section text and posts Gen1+Gen2 together.
    if (isG2Worker(env)) {
      return;
    }

    // Town/nation private Discord channel reconcile disabled (categories removed).
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
    if (event.cron === "*/10 * * * *") {
      ctx.waitUntil(
        runConnectionPreferenceWatchdogCron(env)
          .then((result) =>
            console.log(
              JSON.stringify({
                msg: "rootmc_connection_preference_watchdog",
                ok: result.ok,
                detail: result.detail,
                flipped: result.flipped,
              }),
            ),
          )
          .catch((e) =>
            console.error(
              "rootmc_connection_preference_watchdog_failed",
              e instanceof Error ? e.message : String(e),
            ),
          ),
      );
      ctx.waitUntil(
        runDevWorkstationTimeoutCron(env, when)
          .then((result) =>
            console.log(
              JSON.stringify({
                msg: "rootmc_dev_workstation_timeout",
                ok: result.ok,
                detail: result.detail,
              }),
            ),
          )
          .catch((e) =>
            console.error(
              "rootmc_dev_workstation_timeout_failed",
              e instanceof Error ? e.message : String(e),
            ),
          ),
      );
      ctx.waitUntil(
        resolveServerId(env.DB)
          .then((serverId) => runHostPresenceMaintenance(env.DB, serverId, when))
          .then((result) =>
            console.log(
              JSON.stringify({
                msg: "rootmc_host_presence_maintenance",
                ok: result.ok,
                detail: result.detail,
              }),
            ),
          )
          .catch((e) =>
            console.error(
              "rootmc_host_presence_maintenance_failed",
              e instanceof Error ? e.message : String(e),
            ),
          ),
      );
      ctx.waitUntil(
        runMysqlFullSyncCron(env).catch((e) =>
          console.warn("rootmc_mysql_full_sync", e instanceof Error ? e.message : String(e)),
        ),
      );
      ctx.waitUntil(
        runMysqlEconomyPullCron(env).catch((e) =>
          console.warn("rootmc_mysql_economy_pull", e instanceof Error ? e.message : String(e)),
        ),
      );
      // Keep / create the #automated-reports board once an hour (xx:00).
      if (when.getUTCMinutes() < 10) {
        ctx.waitUntil(
          import("./rootmc-automated-reports-board")
            .then(({ refreshAutomatedReportsBoard }) => refreshAutomatedReportsBoard(env))
            .then((board) => console.log("rootmc_reports_board_hourly", board.detail))
            .catch((e) =>
              console.warn(
                "rootmc_reports_board_hourly_failed",
                e instanceof Error ? e.message : String(e),
              ),
            ),
        );
      }
      // Catch-up only — skips if midnight suite already landed in D1.
      ctx.waitUntil(
        maybeRunDailyReports(env, when).catch((e) =>
          console.error("rootmc_daily_reports_failed", e instanceof Error ? e.message : String(e)),
        ),
      );
    }
    // Retry every 10 min after Sunday 08:00 HST until weekly awards are in D1.
    ctx.waitUntil(
      maybeRunWeeklyReports(env, when).catch((e) =>
        console.error("rootmc_weekly_reports_failed", e instanceof Error ? e.message : String(e)),
      ),
    );
    if (event.cron === "0 * * * *" && isMonthlyDividendCronSlot(when)) {
      ctx.waitUntil(
        runMonthlyTreasuryDividendCron(env).catch((e) =>
          console.error("rootmc_treasury_dividend_failed", e instanceof Error ? e.message : String(e)),
        ),
      );
    }
    if (event.cron === "0 * * * *") {
      // Daily AI suite only at HST midnight — not every hour.
      if (isHstMidnightHour(when)) {
        ctx.waitUntil(
          maybeRunDailyReports(env, when).catch((e) =>
            console.error("rootmc_daily_reports_failed", e instanceof Error ? e.message : String(e)),
          ),
        );
      }
      // Historical Claims vote backfill is manual-only (POST /api/rootmc/votes/claims-backfill).
      // Hourly auto-backfill was flooding players with batch Claims credits for votes already paid on Towny.
      ctx.waitUntil(
        runWebstatPullCron(env)
          .then((r) =>
            console.log(
              JSON.stringify({
                msg: "rootmc_webstat_pull",
                ok: r.ok,
                attempted: r.attempted,
                stored: r.stored,
                skipped: r.skipped,
                errors: r.errors,
              }),
            ),
          )
          .catch((e) =>
            console.warn("rootmc_webstat_pull", e instanceof Error ? e.message : String(e)),
          ),
      );
      // Combined Gen1+Gen2 hourly snapshot (fetches Gen2 section from api2, one Discord post).
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
