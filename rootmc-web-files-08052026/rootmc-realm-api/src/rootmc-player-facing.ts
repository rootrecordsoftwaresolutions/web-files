/** Player-facing copy rules for public RootMC Discord intelligence reports. */

import type { TreasuryReportBrief } from "./rootmc-treasury";
import { TREASURY_TYPE_GLOSSARY, TOWNY_INTAKE_GLOSSARY } from "./rootmc-treasury";
import { normalizeDiscordMarkdown } from "./rootmc-discord-markdown";

export const ROOTMC_PLAYER_AUDIENCE_RULES =
  "Audience: RootMC players and staff in public Discord  -  never developers. " +
  "Use plain in-game language. Do not mention plugins, sync, APIs, backends, data pipelines, " +
  "or how metrics are collected. " +
  "Currency is Gold only  -  write amounts like **47.76 Gold** or **12.5k Gold**. " +
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
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(3)}M Gold`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k Gold`;
  if (Number.isInteger(n)) return `${n.toLocaleString()} Gold`;
  return `${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })} Gold`;
}

type EconomyTotals = {
  trackedPlayers: number;
  totalNetWorth: number;
  totalBalance: number;
  totalGoldMinted: number;
  totalGoldMined?: number;
  /** null = shop sync missing/stale — never invent a host zero from absent data. */
  shopListings: number | null;
  pricedItems: number;
  syncedAt?: string | null;
};

function formatShopListings(count: number | null | undefined): string {
  if (count == null || !Number.isFinite(Number(count))) return "n/a (not tracked)";
  return String(Math.max(0, Math.floor(Number(count))));
}

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
    combined_net_worth: formatReportGold(Math.max(0, Number(economy.totalNetWorth) || 0)),
    active_shop_listings: formatShopListings(economy.shopListings),
    items_with_shop_prices: economy.pricedItems,
    metric_definitions: {
      wallet_gold: "Spendable Gold in the player's account only (Vault balance)",
      total_gold_mined: "All-time gold found/mined on this host  -  audited on rootmc.net/economy; not treasury grants",
      total_gold_minted: "Same as gold mined on this host",
      net_worth:
        "Total tracked wealth on that host: wallet + inventory/shop stock (Towny) or wallet + physical gold scan (Claims).",
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
        server_reserve: "Closed-loop treasury (Server Reserve)  -  taxes, Towny fees, votes, death fees in; grants, loans out",
      },
    },
  };
}

export function formatTreasuryBriefAppendix(brief: TreasuryReportBrief, syncedAtLabel?: string): string {
  const inflows = ledgerLinesByDirection("inflow", brief.month_by_type);
  const outflows = ledgerLinesByDirection("outflow", brief.month_by_type);
  const stamp = syncedAtLabel || brief.synced_at || "unknown";
  return [
    `_Server Reserve  -  synced ${stamp} HST_`,
    "",
    "**Reserve balance**",
    `- **Balance:** ${formatReportGold(brief.reserve_balance ?? 0)}`,
    `- **All-time net (ledger):** ${formatReportGold(brief.all_time_net)}`,
    `- **Avg monthly net:** ${formatReportGold(brief.average_monthly_net)}`,
    "",
    `**${brief.current_hst_month} month-to-date**`,
    `- **Inflow:** ${formatReportGold(brief.month_inflow)}  -  **Outflow:** ${formatReportGold(brief.month_outflow)}  -  **Net:** ${formatReportGold(brief.month_net)}`,
    inflows.length ? `- **Inflows:** ${inflows.map((r) => `${r.label} ${r.amount}`).join("  -  ")}` : "",
    outflows.length ? `- **Outflows:** ${outflows.map((r) => `${r.label} ${r.amount}`).join("  -  ")}` : "",
    "",
    "**Towny fees to reserve (MTD)**",
    `- Claims ${formatReportGold(brief.towny_intake_mtd.claims)}  -  New towns ${formatReportGold(brief.towny_intake_mtd.new_town)}  -  New nations ${formatReportGold(brief.towny_intake_mtd.new_nation)}  -  Services ${formatReportGold(brief.towny_intake_mtd.service_fees)}  -  **Total** ${formatReportGold(brief.towny_intake_mtd.total)}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Side-by-side Towny vs Claims metrics for Grok + Discord appendix. */
export function hostComparisonForPlayers(
  towny: {
    name?: string;
    economy: EconomyTotals;
  },
  claims: {
    name?: string;
    onlinePlayers?: number | null;
    economy: EconomyTotals;
  },
) {
  const row = (metric: string, townyVal: string | number, claimsVal: string | number) => ({
    metric,
    towny: townyVal,
    claims: claimsVal,
  });
  const netWorthCell = (eco: EconomyTotals) => formatReportGold(Math.max(0, Number(eco.totalNetWorth) || 0));
  return {
    instruction:
      "REQUIRED: present Towny and Claims as an equal side-by-side comparison for host-specific economy only. Playtime and votes are realm-merged — never show per-host playtime. linked_players is realm-wide. Never invent realm-wide economy totals. Cite both hosts' combined_net_worth figures from host_comparison.",
    columns: {
      towny: towny.name || "Towny",
      claims: claims.name || "Claims",
    },
    rows: [
      row(
        "gold_in_wallets",
        formatReportGold(towny.economy.totalBalance),
        formatReportGold(claims.economy.totalBalance),
      ),
      row("combined_net_worth", netWorthCell(towny.economy), netWorthCell(claims.economy)),
      row(
        "gold_mined_all_time",
        formatReportGold(towny.economy.totalGoldMined ?? towny.economy.totalGoldMinted),
        formatReportGold(claims.economy.totalGoldMined ?? claims.economy.totalGoldMinted),
      ),
      row("shop_listings", formatShopListings(towny.economy.shopListings), formatShopListings(claims.economy.shopListings)),
      row("players_with_wallets", towny.economy.trackedPlayers, claims.economy.trackedPlayers),
      row("players_online", "see live status", claims.onlinePlayers ?? "n/a"),
    ],
  };
}

export function formatHostComparisonAppendix(
  townyEco: EconomyTotals,
  claimsEco: EconomyTotals,
  labels?: { towny?: string; claims?: string },
): string {
  const t = labels?.towny || "Towny";
  const c = labels?.claims || "Claims";
  const line = (label: string, a: string | number, b: string | number) =>
    `- **${label}:** ${t} **${a}**  |  ${c} **${b}**`;
  const nw = (eco: EconomyTotals) => formatReportGold(Math.max(0, Number(eco.totalNetWorth) || 0));
  return [
    line("Gold in wallets", formatReportGold(townyEco.totalBalance), formatReportGold(claimsEco.totalBalance)),
    line("Combined net worth", nw(townyEco), nw(claimsEco)),
    line(
      "Gold mined (all-time)",
      formatReportGold(townyEco.totalGoldMined ?? townyEco.totalGoldMinted),
      formatReportGold(claimsEco.totalGoldMined ?? claimsEco.totalGoldMinted),
    ),
    line("Shop listings", formatShopListings(townyEco.shopListings), formatShopListings(claimsEco.shopListings)),
    line("Players with wallets", townyEco.trackedPlayers, claimsEco.trackedPlayers),
  ].join("\n");
}

function formatPlayLabel(seconds: number): string {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

type DualHostPlayRow = {
  minecraft_username?: string | null;
  total_playtime_seconds?: number | null;
};

function formatNetWorthLine(eco: EconomyTotals): string {
  return formatReportGold(Math.max(0, Number(eco.totalNetWorth) || 0));
}

/** Light Towny/Claims glance for the daily summary — economy brief owns the deep metrics. */
export function formatEqualDualHostDailyBody(input: {
  linked: number;
  playersWithPlaytime: number;
  playtime: DualHostPlayRow[];
  towny: {
    economy: EconomyTotals;
    townCount?: number;
    nationCount?: number;
    totalPlots?: number;
  };
  claims: {
    economy: EconomyTotals;
    onlinePlayers?: number | null;
  };
}): string {
  const line = (label: string, a: string | number, b: string | number) =>
    `- **${label}:** Towny **${a}**  |  Claims **${b}**`;
  const topPt = input.playtime[0];
  const playtimeNote = topPt
    ? `_Realm playtime (shared): **${input.playersWithPlaytime}** players · top **${String(topPt.minecraft_username || "Unknown").trim() || "Unknown"}** at ${formatPlayLabel(Number(topPt.total_playtime_seconds) || 0)}_`
    : `_Realm playtime (shared): **${input.playersWithPlaytime}** players_`;
  const land =
    input.towny.townCount != null
      ? `- **Towny land:** **${input.towny.townCount ?? 0}** towns / **${input.towny.nationCount ?? 0}** nations / **${input.towny.totalPlots ?? 0}** plots`
      : "";

  return [
    "## Towny vs Claims",
    "",
    line(
      "Gold in wallets",
      formatReportGold(input.towny.economy.totalBalance),
      formatReportGold(input.claims.economy.totalBalance),
    ),
    line(
      "Players with wallets",
      input.towny.economy.trackedPlayers,
      input.claims.economy.trackedPlayers,
    ),
    input.claims.onlinePlayers != null
      ? `- **Claims online:** **${input.claims.onlinePlayers}**`
      : "",
    land,
    "",
    `_Linked players (realm-wide): **${input.linked}**_`,
    playtimeNote,
    "",
    `_Full economy detail is in the Economy brief._`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Discord activity block for the daily summary (counts only — no message quotes). */
export function formatDiscordDailySection(input: {
  memberCount: number;
  totalMessages: number;
  topChannels: { name: string; count: number }[];
}): string {
  const lines = [
    "## Discord",
    "",
    `- **Members:** **${Math.max(0, Math.floor(Number(input.memberCount) || 0))}**`,
    `- **Messages yesterday:** **${Math.max(0, Math.floor(Number(input.totalMessages) || 0))}**`,
  ];
  if (input.topChannels.length) {
    lines.push(
      `- **Busiest channels:** ${input.topChannels
        .slice(0, 5)
        .map((c) => `**#${String(c.name || "channel").replace(/^#/, "")}** (${c.count})`)
        .join("; ")}`,
    );
  }
  return lines.join("\n");
}

/** Keep only Executive Summary + Outlook from model text; host/Discord sections are injected in code. */
export function extractExecutiveAndOutlook(reportText: string): {
  executive: string;
  outlook: string;
} {
  const text = String(reportText || "").trim();
  const pull = (title: string) => {
    const re = new RegExp(`##\\s*${title}\\s*\\n+([\\s\\S]*?)(?=\\n##\\s|$)`, "i");
    const m = text.match(re);
    return m ? m[1].trim() : "";
  };
  let executive = pull("Executive Summary");
  const outlook = pull("Outlook");
  if (!executive && text && !/^##\s/m.test(text)) {
    executive = text.slice(0, 500);
  }
  return { executive, outlook };
}

export function composeDualHostDailyReportText(opts: {
  aiReportText: string;
  discordSection: string;
  dualHostBody: string;
}): string {
  const { executive, outlook } = extractExecutiveAndOutlook(opts.aiReportText);
  const parts = [
    "## Executive Summary",
    "",
    executive || "_See Discord and host glance below._",
    "",
    opts.discordSection.trim(),
    "",
    opts.dualHostBody.trim(),
  ];
  if (outlook) {
    parts.push("", "## Outlook", "", outlook);
  }
  return parts.join("\n").trim();
}

export function formatEqualDualHostEconomyBody(input: {
  linked: number;
  playersWithPlaytime: number;
  playtime: DualHostPlayRow[];
  towny: {
    economy: EconomyTotals;
    wallets: NetWorthRow[];
  };
  claims: {
    economy: EconomyTotals;
    wallets: NetWorthRow[];
  };
}): string {
  const hostBlock = (
    title: string,
    host: {
      economy: EconomyTotals;
      wallets: NetWorthRow[];
    },
  ) => {
    const wallets = walletLeaderboardForPlayers(host.wallets, 3);
    const lines = [
      `## ${title} Economy`,
      "",
      `- **Gold in wallets:** ${formatReportGold(host.economy.totalBalance)} (**${host.economy.trackedPlayers}** players)`,
      `- **Combined net worth:** ${formatNetWorthLine(host.economy)}`,
      `- **Gold mined (all-time):** ${formatReportGold(host.economy.totalGoldMined ?? host.economy.totalGoldMinted)}`,
      `- **Shop listings:** **${formatShopListings(host.economy.shopListings)}**`,
    ];
    if (wallets.length) {
      lines.push(
        `- **Top wallets:** ${wallets.map((w) => `**${w.player}** ${w.wallet_gold}`).join("; ")}`,
      );
    }
    return lines.join("\n");
  };

  const comparison = formatHostComparisonAppendix(input.towny.economy, input.claims.economy, {
    towny: "Towny",
    claims: "Claims",
  });

  const topPt = input.playtime[0];
  const playtimeNote = topPt
    ? `_Realm playtime (shared Towny+Claims): **${input.playersWithPlaytime}** players · top **${String(topPt.minecraft_username || "Unknown").trim() || "Unknown"}** at ${formatPlayLabel(Number(topPt.total_playtime_seconds) || 0)}_`
    : `_Realm playtime (shared Towny+Claims): **${input.playersWithPlaytime}** players_`;

  return [
    "## Towny vs Claims",
    "",
    comparison,
    "",
    `_Realm-wide linked players (shared): **${input.linked}**_`,
    playtimeNote,
    "",
    hostBlock("Towny", input.towny),
    "",
    hostBlock("Claims", input.claims),
  ].join("\n");
}

export function composeDualHostEconomyReportText(opts: {
  aiReportText: string;
  dualHostBody: string;
}): string {
  const text = String(opts.aiReportText || "").trim();
  const pull = (title: string) => {
    const re = new RegExp(`##\\s*${title}\\s*\\n+([\\s\\S]*?)(?=\\n##\\s|$)`, "i");
    const m = text.match(re);
    return m ? m[1].trim() : "";
  };
  const overview = pull("Market Overview") || pull("Executive Summary");
  const outlook = pull("Outlook");
  const parts = [
    "## Market Overview",
    "",
    overview || "_See equal Towny / Claims sections below._",
    "",
    opts.dualHostBody.trim(),
  ];
  if (outlook) {
    parts.push("", "## Outlook", "", outlook);
  }
  return parts.join("\n").trim();
}

/** Grok prompt + Discord appendix payload for economy_intel briefs (Towny + Claims hosts). */
export function economyIntelBriefContext(
  economy: EconomyTotals,
  netWorthRows: NetWorthRow[],
  treasury: TreasuryReportBrief,
  netWorthLimit = 15,
  claims?: {
    displayName: string;
    joinAddress: string;
    onlinePlayers: number | null;
    linked?: number;
    economy: EconomyTotals;
    netWorth: NetWorthRow[];
    wallets?: NetWorthRow[];
  },
  townyMeta?: {
    displayName: string;
    linked?: number;
    playersWithPlaytime?: number;
    playtime?: { minecraft_username?: string | null; total_playtime_seconds?: number | null }[];
    wallets?: NetWorthRow[];
  },
) {
  const formatPlay = (seconds: number) => {
    const s = Math.max(0, Math.floor(Number(seconds) || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };
  const playLeaders = (
    rows: { minecraft_username?: string | null; total_playtime_seconds?: number | null }[] | undefined,
  ) =>
    (rows || []).slice(0, 5).map((p, i) => ({
      rank: i + 1,
      player: String(p.minecraft_username || "Unknown").trim() || "Unknown",
      playtime: formatPlay(Number(p.total_playtime_seconds) || 0),
    }));

  const claimsEco = claims?.economy || {
    totalBalance: 0,
    totalNetWorth: 0,
    totalGoldMinted: 0,
    totalGoldMined: 0,
    shopListings: null,
    pricedItems: 0,
    trackedPlayers: 0,
  };
  const realmLinked = townyMeta?.linked ?? claims?.linked ?? null;
  const townyWallets = townyMeta?.wallets?.length ? townyMeta.wallets : netWorthRows;
  const claimsWallets = claims?.wallets?.length ? claims.wallets : claims?.netWorth || [];

  return {
    ...treasuryIntelBriefContext(treasury),
    realm_note:
      "RootMC has two equal public hosts. Playtime and votes are realm-merged (show once, not per host). linked_players is realm-wide. REQUIRED output starts with ## Towny vs Claims using host_comparison.rows (Towny | Claims). Never invent different linked/playtime counts per host. Never treat wallet totals as combined net worth. Never sum host wallets.",
    linked_players: realmLinked,
    linked_players_note: "Realm-wide Discord-linked Minecraft accounts — identical for Towny and Claims.",
    realm_playtime: {
      players_with_playtime: townyMeta?.playersWithPlaytime ?? null,
      top_playtime: playLeaders(townyMeta?.playtime),
      note: "Shared Towny+Claims playtime pool — do not duplicate under each host.",
    },
    host_comparison: hostComparisonForPlayers(
      {
        name: townyMeta?.displayName || "Towny",
        economy,
      },
      {
        name: claims?.displayName || "Claims",
        onlinePlayers: claims?.onlinePlayers ?? null,
        economy: claimsEco,
      },
    ),
    hosts: {
      towny: {
        name: townyMeta?.displayName || "Towny",
        economy: economyContextForPlayers(economy),
        top_wallet_balances: walletLeaderboardForPlayers(townyWallets),
        top_net_worth: netWorthLeaderboardForPlayers(netWorthRows, netWorthLimit),
      },
      claims: claims
        ? {
            name: claims.displayName || "Claims",
            join_address: claims.joinAddress,
            players_online: claims.onlinePlayers,
            economy: economyContextForPlayers(claims.economy),
            top_wallet_balances: walletLeaderboardForPlayers(claimsWallets),
            top_net_worth:
              Number(claims.economy.totalNetWorth) > 0
                ? netWorthLeaderboardForPlayers(
                    (claims.netWorth?.length ? claims.netWorth : claimsWallets).map((row) => ({
                      ...row,
                      total_value:
                        Number(row.total_value) > 0 ? Number(row.total_value) : Number(row.balance_value) || 0,
                    })),
                    netWorthLimit,
                  )
                : walletLeaderboardForPlayers(claimsWallets, netWorthLimit).map((w) => ({
                    rank: w.rank,
                    player: w.player,
                    net_worth: w.wallet_gold,
                    wallet_gold: w.wallet_gold,
                  })),
          }
        : null,
    },
  };
}

export function formatEconomyBriefAppendix(
  economy: EconomyTotals,
  netWorthRows: NetWorthRow[],
  syncedAtLabel: string,
  treasury?: TreasuryReportBrief,
  claims?: {
    displayName: string;
    economy: EconomyTotals;
    netWorth: NetWorthRow[];
  },
): string {
  const hostBlock = (
    title: string,
    eco: EconomyTotals,
    walletRows: NetWorthRow[],
    nwRows: NetWorthRow[],
  ) => {
    const wallets = walletLeaderboardForPlayers(walletRows, 5);
    const netWorth =
      Number(eco.totalNetWorth) > 0 ? netWorthLeaderboardForPlayers(nwRows, 5) : [];
    return [
      `**${title}**`,
      `- **Gold in wallets:** ${formatReportGold(eco.totalBalance)} (${eco.trackedPlayers} players)`,
      `- **Gold mined (all-time):** ${formatReportGold(eco.totalGoldMined ?? eco.totalGoldMinted)}`,
      `- **Combined net worth:** ${formatReportGold(Math.max(0, Number(eco.totalNetWorth) || 0))}`,
      `- **Shop listings:** ${formatShopListings(eco.shopListings)}`,
      wallets.length
        ? wallets.map((w) => `  ${w.rank}. ${w.player}  -  ${w.wallet_gold}`).join("\n")
        : "  _No wallet balances tracked._",
      netWorth.length
        ? netWorth.map((w) => `  ${w.rank}. ${w.player}  -  ${w.net_worth}`).join("\n")
        : "  _No net worth rankings yet._",
    ].join("\n");
  };

  const claimsEco = claims?.economy || {
    totalBalance: 0,
    totalNetWorth: 0,
    totalGoldMinted: 0,
    totalGoldMined: 0,
    shopListings: null,
    pricedItems: 0,
    trackedPlayers: 0,
  };

  const parts = [
    `_Live economy snapshot  -  synced ${syncedAtLabel} HST_`,
    `_**Wallet Gold** = spendable balance only  -  **Net worth** = wallet + items + shop stock (when tracked)_`,
    `_Towny and Claims compared side-by-side — totals are never combined. Playtime/votes/links are realm-wide._`,
    "",
    formatHostComparisonAppendix(economy, claimsEco, {
      towny: "Towny",
      claims: claims?.displayName || "Claims",
    }),
    "",
    hostBlock("Towny detail", economy, netWorthRows, netWorthRows),
  ];
  if (claims) {
    parts.push(
      "",
      hostBlock(
        `${claims.displayName || "Claims"} detail`,
        claims.economy,
        claims.netWorth,
        claims.netWorth,
      ),
    );
  }
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
