import { roundGold } from "./discord-rootmc-economy";

/** Matches root-essentials transaction tax on /mint (used to estimate legacy mint gross from tax rows). */
export const MINT_TRANSACTION_TAX_RATE = 0.001;

export type MintLeaderboardRow = {
  rank: number;
  minecraft_uuid: string;
  minecraft_username: string | null;
  gross_minted_g: number;
  mint_events: number;
};

function str(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

/** Gross G from a single /mint treasury TAX row (`mint:gross=…`, `mint:redeem=…`, or legacy `mint` + tax). */
export function mintGrossFromLedgerRow(amount: unknown, details: unknown): number {
  let detailStr = str(details);
  const reclassPrefix = "correction:tax_reclass:";
  if (detailStr.startsWith(reclassPrefix)) {
    detailStr = detailStr.slice(reclassPrefix.length);
  }
  const redeemMatch = /^mint:redeem=([0-9]+(?:\.[0-9]+)?)$/.exec(detailStr);
  if (redeemMatch) {
    return -roundGold(Number(redeemMatch[1]) || 0);
  }
  const grossMatch = /^mint:gross=([0-9]+(?:\.[0-9]+)?)$/.exec(detailStr);
  if (grossMatch) {
    return roundGold(Number(grossMatch[1]) || 0);
  }
  if (detailStr === "mint") {
    const tax = Number(amount) || 0;
    if (tax > 0) return roundGold(tax / MINT_TRANSACTION_TAX_RATE);
  }
  return 0;
}

/** Audit-only /mint markers (amount 0 in MySQL — gross/redeem lives in details). */
export function isMintAuditTrail(details: unknown): boolean {
  let d = str(details);
  const reclassPrefix = "correction:tax_reclass:";
  if (d.startsWith(reclassPrefix)) d = d.slice(reclassPrefix.length);
  return d.startsWith("mint:gross=") || d.startsWith("mint:redeem=");
}
