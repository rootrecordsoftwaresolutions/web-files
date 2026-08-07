/** Player-facing copy rules for public RootMC Discord intelligence reports. */

import type { TreasuryReportBrief } from "./rootmc-treasury";
import { TREASURY_TYPE_GLOSSARY, TOWNY_INTAKE_GLOSSARY } from "./rootmc-treasury";
import { ROOTMC_RESERVE_GOLD_MINED } from "./rootmc-site";

import { normalizeDiscordMarkdown } from "./rootmc-discord-markdown";

export const ROOTMC_PLAYER_AUDIENCE_RULES =
  "Audience: RootMC players and staff in public Discord — never developers. " +
  "Use plain in-game language. Do not mention plugins, sync, APIs, backends, data pipelines, " +
  "or how metrics are collected. " +
  "Currency is Gold only — write amounts like **47.76 Gold** or **12.5k Gold**. " +
  "Never use $, USD, dollars, or real-world money. " +
  "**Net worth** = a player's or the server's total tracked wealth (balance + items + shops, etc.). " +
  "**Wallet Gold** / **balance** = Gold in their account only. Never call net worth 'Gold total' or 'total Gold'. " +
  "Do not cite server IDs, UUIDs, or internal field names from the JSON. ";

export function sanitizePlayerFacingReport(text: string): string {
  let out = String(text || "");
  out = out.replace(/\$\s*([0-9][0-9,]*(?:\.[0-9]+)?)/g, "$1 Gold");
  out = out.replace(/\bUSD\b/gi, "Gold");
  out = out.replace(/\bdollars?\b/gi, "Gold");
  out = out.replace(/\b(?:gold total|total gold(?!\s+minted))\b/gi, "net worth");
  out = out.replace(/\bsync(?:\s+health|\s+status)?\b/gi, "server activity");
  out = out.replace(/\b(?:rootstat|rootmc|plugin)\b/gi, "");
  out = out.replace(/ {2,}/g, " ");
  return normalizeDiscordMarkdown(out.trim());
}

export function formatReportGold(value: number): string {
  const n = Math.max(0, Number(value) || 0);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M Gold`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k Gold`;
  if (Number.isInteger(n)) return `${n.toLocaleString()} Gold`;
  return `${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} Gold`;
}

type EconomyTotals = {
  trackedPlayers: number;
  totalNetWorth: number;
  totalBalance: number;
  totalGoldMinted: number;
  totalGoldMined?: number;
  shopListings: number;
  pricedItems: number;
};

type NetWorthRow = {
  minecraft_username?: string | null;
  total_value?: number | null;
  balance_value?: number | null;
};

export function economyContextForPlayers(economy: EconomyTotals) {
  return {
    currency: "Gold",
    players_with_balances: economy.trackedPlayers,
    gold_in_wallets_total: formatReportGold(economy.totalBalance),
    total_gold_mined: formatReportGold(economy.totalGoldMined ?? economy.totalGoldMinted),
    total_gold_minted: formatReportGold(economy.totalGoldMinted),
    combined_net_worth: formatReportGold(economy.totalNetWorth),
    active_shop_listings: economy.shopListings,
    items_with_shop_prices: economy.pricedItems,
    metric_definitions: {
      wallet_gold: "Spendable Gold in the player's account only (Vault balance)",
      total_gold_mined: "All-time physical gold mined via /mint (post-reset ledger gross) — audited on rootmc.net/economy; not treasury grants or reserve carryover",
      total_gold_minted: "Same as gold mined — physical /mint only, not treasury grants",
      net_worth: "Total tracked wealth: wallet + inventory + shop stock qty × blended buy-side reference — NOT per-listing sign prices",
    },
  };
}

export function walletLeaderboardForPlayers(rows: NetWorthRow[], limit = 8) {
  return [...rows]
    .sort((a, b) => (Number(b.balance_value) || 0) - (Number(a.balance_value) || 0))
    .slice(0, limit)
    .map((row, i) => ({
      rank: i + 1,
      player: String(row.minecraft_username || "Unknown").trim() || "Unknown",
      wallet_gold: formatReportGold(Number(row.balance_value) || 0),
    }));
}

export function netWorthLeaderboardForPlayers(rows: NetWorthRow[], limit = 15) {
  return rows.slice(0, limit).map((row, i) => ({
    rank: i + 1,
    player: String(row.minecraft_username || "Unknown").trim() || "Unknown",
    net_worth: formatReportGold(Number(row.total_value) || 0),
    wallet_gold: formatReportGold(Number(row.balance_value) || 0),
  }));
}

function ledgerLinesByDirection(direction: "inflow" | "outflow", byType: Record<string, number>) {
  return TREASURY_TYPE_GLOSSARY.filter((g) => g.direction === direction)
    .map((g) => ({ label: g.label, amount: Number(byType[g.type]) || 0 }))
    .filter((row) => row.amount > 0)
    .map((row) => ({ label: row.label, amount: formatReportGold(row.amount) }));
}

export function treasuryIntelBriefContext(brief: TreasuryReportBrief) {
  return {
    server_reserve: {
      balance: formatReportGold(brief.reserve_balance ?? 0),
      synced_at: brief.synced_at,
      current_hst_month: brief.current_hst_month,
      prior_hst_month: brief.prior_hst_month,
      month_to_date: {
        inflow: formatReportGold(brief.month_inflow),
        outflow: formatReportGold(brief.month_outflow),
        net: formatReportGold(brief.month_net),
        inflows_by_source: ledgerLinesByDirection("inflow", brief.month_by_type),
        outflows_by_source: ledgerLinesByDirection("outflow", brief.month_by_type),
      },
      prior_month_net: formatReportGold(brief.prior_month_net),
      all_time_net: formatReportGold(brief.all_time_net),
      average_monthly_net: formatReportGold(brief.average_monthly_net),
      towny_fees_mtd: {
        new_towns: formatReportGold(brief.towny_intake_mtd.new_town),
        new_nations: formatReportGold(brief.towny_intake_mtd.new_nation),
        claims: formatReportGold(brief.towny_intake_mtd.claims),
        service_fees: formatReportGold(brief.towny_intake_mtd.service_fees),
        total: formatReportGold(brief.towny_intake_mtd.total),
        glossary: TOWNY_INTAKE_GLOSSARY.map((g) => g.label),
      },
      metric_definitions: {
        server_reserve: "Closed-loop treasury (Server Reserve) — taxes, Towny fees, votes, death fees in; grants, loans out",
      },
    },
  };
}

export function formatTreasuryBriefAppendix(brief: TreasuryReportBrief, syncedAtLabel?: string): string {
  const inflows = ledgerLinesByDirection("inflow", brief.month_by_type);
  const outflows = ledgerLinesByDirection("outflow", brief.month_by_type);
  const stamp = syncedAtLabel || brief.synced_at || "unknown";
  return [
    `_Server Reserve · synced ${stamp} HST_`,
    "",
    "**Reserve balance**",
    `• **Balance:** ${formatReportGold(brief.reserve_balance ?? 0)} (July opening + post-reset ledger net)`,
    `• **All-time net (ledger):** ${formatReportGold(brief.all_time_net)}`,
    `• **Avg monthly net:** ${formatReportGold(brief.average_monthly_net)}`,
    "",
    `**${brief.current_hst_month} month-to-date**`,
    `• **Inflow:** ${formatReportGold(brief.month_inflow)} · **Outflow:** ${formatReportGold(brief.month_outflow)} · **Net:** ${formatReportGold(brief.month_net)}`,
    inflows.length ? `• **Inflows:** ${inflows.map((r) => `${r.label} ${r.amount}`).join(" · ")}` : "",
    outflows.length ? `• **Outflows:** ${outflows.map((r) => `${r.label} ${r.amount}`).join(" · ")}` : "",
    "",
    "**Towny fees to reserve (MTD)**",
    `• Claims ${formatReportGold(brief.towny_intake_mtd.claims)} · New towns ${formatReportGold(brief.towny_intake_mtd.new_town)} · New nations ${formatReportGold(brief.towny_intake_mtd.new_nation)} · Services ${formatReportGold(brief.towny_intake_mtd.service_fees)} · **Total** ${formatReportGold(brief.towny_intake_mtd.total)}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Grok prompt + Discord appendix payload for economy_intel briefs. */
export function economyIntelBriefContext(
  economy: EconomyTotals,
  netWorthRows: NetWorthRow[],
  treasury: TreasuryReportBrief,
  netWorthLimit = 15,
) {
  return {
    ...treasuryIntelBriefContext(treasury),
    economy: economyContextForPlayers(economy),
    top_wallet_balances: walletLeaderboardForPlayers(netWorthRows),
    top_net_worth: netWorthLeaderboardForPlayers(netWorthRows, netWorthLimit),
  };
}

export function formatEconomyBriefAppendix(
  economy: EconomyTotals,
  netWorthRows: NetWorthRow[],
  syncedAtLabel: string,
  treasury?: TreasuryReportBrief,
): string {
  const wallets = walletLeaderboardForPlayers(netWorthRows, 8);
  const netWorth = netWorthLeaderboardForPlayers(netWorthRows, 8);
  const parts = [
    `_Live economy snapshot · synced ${syncedAtLabel} HST_`,
    `_**Wallet Gold** = spendable balance only · **Net worth** = wallet + items + shop stock_`,
    "",
    "**Player economy totals**",
    `• **Gold in wallets (combined):** ${formatReportGold(economy.totalBalance)} (${economy.trackedPlayers} players)`,
    `• **TOTAL GOLD MINED ALL TIME:** **${formatReportGold(economy.totalGoldMined ?? economy.totalGoldMinted)}** · [audited ledger](${ROOTMC_RESERVE_GOLD_MINED})`,
    `• **Combined net worth:** ${formatReportGold(economy.totalNetWorth)}`,
    `• **Shop listings:** ${economy.shopListings}`,
    "",
    "**Wallet balances**",
    wallets.length > 0
      ? wallets.map((w) => `${w.rank}. ${w.player} — ${w.wallet_gold}`).join("\n")
      : "_No wallet balances tracked._",
    "",
    "**Net worth**",
    netWorth.length > 0
      ? netWorth
          .map((w) => `${w.rank}. ${w.player} — ${w.net_worth} _(wallet: ${w.wallet_gold})_`)
          .join("\n")
      : "_No net worth rankings yet._",
  ];
  if (treasury) {
    parts.push("", formatTreasuryBriefAppendix(treasury, syncedAtLabel));
  }
  return parts.join("\n");
}

export function discordActivityForPlayers(discord: {
  memberCount: number;
  totalMessages: number;
  topChannels: { name: string; count: number }[];
}) {
  return {
    discord_members: discord.memberCount,
    messages_yesterday: discord.totalMessages,
    busiest_channels: discord.topChannels.slice(0, 6).map((c) => ({
      channel: c.name,
      messages: c.count,
    })),
  };
}
