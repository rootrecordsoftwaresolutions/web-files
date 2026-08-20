/**
 * RootMC Stripe Pro fulfillment helpers (shared so stripe-webhook can call them).
 */
import type { BillingD1 } from "./billing-state";
import { applyStripeBillingPatch, applyStripeBillingRevoke } from "./apply-stripe-billing";

export const PRO_VOUCHER_ITEM_MONTH = "PRO_VOUCHER_MONTH";
export const PRO_VOUCHER_ITEM_LIFE = "PRO_VOUCHER_LIFE";

export type ProVoucherTier = "one_month" | "lifetime";

export type RootMcStripePrices = {
  monthly?: string;
  oneMonth?: string;
  lifetime?: string;
  defaultServerId?: string;
};

export type StripeBeneficiary = {
  accountId: string;
  email: string;
  minecraftUuid: string | null;
  minecraftUsername: string | null;
};

export function parseRootMcStripePrices(env: {
  STRIPE_ROOTMC_PRICE_MONTHLY?: string;
  STRIPE_ROOTMC_PRICE_ONE_MONTH?: string;
  STRIPE_ROOTMC_PRICE_LIFETIME?: string;
  ROOTMC_DEFAULT_SERVER_ID?: string;
}): RootMcStripePrices {
  return {
    monthly: String(env.STRIPE_ROOTMC_PRICE_MONTHLY || "").trim() || undefined,
    oneMonth: String(env.STRIPE_ROOTMC_PRICE_ONE_MONTH || "").trim() || undefined,
    lifetime: String(env.STRIPE_ROOTMC_PRICE_LIFETIME || "").trim() || undefined,
    defaultServerId: String(env.ROOTMC_DEFAULT_SERVER_ID || "rootmc").trim() || "rootmc",
  };
}

export function classifyRootMcPriceId(
  priceId: string,
  prices: RootMcStripePrices,
): "subscription" | "one_month" | "lifetime" | null {
  const id = priceId.trim();
  if (!id) return null;
  if (prices.monthly && id === prices.monthly) return "subscription";
  if (prices.oneMonth && id === prices.oneMonth) return "one_month";
  if (prices.lifetime && id === prices.lifetime) return "lifetime";
  return null;
}

export function minecraftUsernameFromSession(session: Record<string, unknown>): string {
  const fields = session.custom_fields;
  if (Array.isArray(fields)) {
    for (const f of fields) {
      if (!f || typeof f !== "object") continue;
      const row = f as Record<string, unknown>;
      const key = String(row.key || "").toLowerCase().replace(/[\s-]+/g, "_");
      const label = String(row.label || "").toLowerCase().replace(/[\s-]+/g, " ").trim();
      const isMinecraftField =
        key === "minecraft_username"
        || key === "minecraftusername"
        || key === "ign"
        || key === "username"
        || key.includes("minecraft")
        || label === "minecraft username"
        || label.includes("minecraft");
      if (!isMinecraftField) continue;
      const text = row.text as Record<string, unknown> | undefined;
      const v = typeof text?.value === "string" ? text.value.trim() : "";
      if (v) return v;
    }
  }
  const meta = session.metadata as Record<string, unknown> | undefined;
  for (const k of ["minecraft_username", "minecraftUsername", "ign", "username"]) {
    const v = meta?.[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

/** Stripe Checkout / Payment Link customer email (purchaser receipt). */
export function purchaserEmailFromSession(session: Record<string, unknown>): string {
  const det = session.customer_details as Record<string, unknown> | undefined;
  if (typeof det?.email === "string" && det.email.trim()) {
    return det.email.trim().toLowerCase();
  }
  if (typeof session.customer_email === "string" && session.customer_email.trim()) {
    return session.customer_email.trim().toLowerCase();
  }
  const meta = session.metadata as Record<string, unknown> | undefined;
  for (const k of ["purchaser_email", "buyer_email", "email"]) {
    const v = meta?.[k];
    if (typeof v === "string" && v.trim() && v.includes("@")) return v.trim().toLowerCase();
  }
  return "";
}

export async function resolveBeneficiaryByMinecraftUsername(
  db: BillingD1,
  username: string,
): Promise<StripeBeneficiary | null> {
  const name = username.trim();
  if (!name || name.length > 32) return null;
  const link = await db
    .prepare(
      `SELECT minecraft_uuid, minecraft_username, account_id, email
       FROM rootstat_minecraft_links
       WHERE lower(minecraft_username) = lower(?)
       LIMIT 1`,
    )
    .bind(name)
    .first<{
      minecraft_uuid: string;
      minecraft_username: string | null;
      account_id: string;
      email: string | null;
    }>();
  if (!link?.account_id || !link.email) return null;
  return {
    accountId: String(link.account_id).trim(),
    email: String(link.email).trim().toLowerCase(),
    minecraftUuid: String(link.minecraft_uuid || "").toLowerCase() || null,
    minecraftUsername: link.minecraft_username || name,
  };
}

/** Discord + IGN for public thank-you posts (Minecraft optional). */
export async function resolveSupportAnnounceIdentity(
  db: BillingD1,
  accountId: string,
  fallbackUsername?: string | null,
): Promise<{
  discordUserId: string | null;
  discordUsername: string | null;
  minecraftUsername: string | null;
}> {
  const aid = String(accountId || "").trim();
  if (!aid) {
    return {
      discordUserId: null,
      discordUsername: null,
      minecraftUsername: fallbackUsername?.trim() || null,
    };
  }
  const discord = await db
    .prepare(
      `SELECT discord_user_id, discord_username, discord_global_name
       FROM discord_account_links WHERE account_id = ? LIMIT 1`,
    )
    .bind(aid)
    .first<{
      discord_user_id: string | null;
      discord_username: string | null;
      discord_global_name: string | null;
    }>();
  const mc = await db
    .prepare(
      `SELECT minecraft_username FROM rootstat_minecraft_links WHERE account_id = ? LIMIT 1`,
    )
    .bind(aid)
    .first<{ minecraft_username: string | null }>();
  return {
    discordUserId: String(discord?.discord_user_id || "").trim() || null,
    discordUsername:
      String(discord?.discord_global_name || "").trim()
      || String(discord?.discord_username || "").trim()
      || null,
    minecraftUsername:
      String(mc?.minecraft_username || "").trim()
      || String(fallbackUsername || "").trim()
      || null,
  };
}

function itemKeyForTier(tier: ProVoucherTier): string {
  return tier === "lifetime" ? PRO_VOUCHER_ITEM_LIFE : PRO_VOUCHER_ITEM_MONTH;
}

export async function queueProVoucherToVault(
  db: BillingD1,
  input: {
    tier: ProVoucherTier;
    beneficiary: StripeBeneficiary;
    purchaserEmail?: string | null;
    serverId: string;
    stripeCheckoutSessionId: string | null;
    stripePaymentIntent: string | null;
    stripeChargeId: string | null;
  },
): Promise<{ voucherId: string; vaultOrderId: number | null }> {
  const voucherId = crypto.randomUUID();
  const now = new Date().toISOString();
  const expires = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
  const itemKey = itemKeyForTier(input.tier);
  const purchaserEmail = String(input.purchaserEmail || "").trim().toLowerCase() || null;
  const meta = JSON.stringify({
    voucher_id: voucherId,
    tier: input.tier,
    source: "stripe",
    purchaser_email: purchaserEmail,
  });

  let vaultOrderId: number | null = null;
  try {
    const inserted = await db
      .prepare(
        `INSERT INTO rootmc_vault_orders
           (server_id, account_id, minecraft_uuid, item_key, quantity, price_paid, shop_id, status, created_at, expires_at, meta_json)
         VALUES (?, ?, ?, ?, 1, 0, NULL, 'pending', ?, ?, ?)
         RETURNING id`,
      )
      .bind(
        input.serverId,
        input.beneficiary.accountId,
        input.beneficiary.minecraftUuid,
        itemKey,
        now,
        expires,
        meta,
      )
      .first<{ id: number }>();
    vaultOrderId = inserted?.id ?? null;
  } catch {
    const inserted = await db
      .prepare(
        `INSERT INTO rootmc_vault_orders
           (server_id, account_id, minecraft_uuid, item_key, quantity, price_paid, shop_id, status, created_at, expires_at)
         VALUES (?, ?, ?, ?, 1, 0, ?, 'pending', ?, ?)
         RETURNING id`,
      )
      .bind(
        input.serverId,
        input.beneficiary.accountId,
        input.beneficiary.minecraftUuid,
        itemKey,
        voucherId,
        now,
        expires,
      )
      .first<{ id: number }>();
    vaultOrderId = inserted?.id ?? null;
  }

  await db
    .prepare(
      `INSERT INTO rootmc_pro_vouchers
         (id, tier, account_id, email, purchaser_email, minecraft_uuid, minecraft_username,
          stripe_checkout_session_id, stripe_payment_intent, stripe_charge_id,
          vault_order_id, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_vault', ?)`,
    )
    .bind(
      voucherId,
      input.tier,
      input.beneficiary.accountId,
      input.beneficiary.email,
      purchaserEmail,
      input.beneficiary.minecraftUuid,
      input.beneficiary.minecraftUsername,
      input.stripeCheckoutSessionId,
      input.stripePaymentIntent,
      input.stripeChargeId,
      vaultOrderId,
      now,
    )
    .run();

  return { voucherId, vaultOrderId };
}

export async function voidOrRevokeVouchersForStripeObject(
  db: BillingD1,
  refs: { chargeId?: string | null; sessionId?: string | null; paymentIntent?: string | null },
): Promise<void> {
  const clauses: string[] = [];
  const binds: string[] = [];
  if (refs.chargeId) {
    clauses.push("stripe_charge_id = ?");
    binds.push(refs.chargeId);
  }
  if (refs.sessionId) {
    clauses.push("stripe_checkout_session_id = ?");
    binds.push(refs.sessionId);
  }
  if (refs.paymentIntent) {
    clauses.push("stripe_payment_intent = ?");
    binds.push(refs.paymentIntent);
  }
  if (!clauses.length) return;

  const { results } = await db
    .prepare(`SELECT id, tier, account_id, email, status, vault_order_id FROM rootmc_pro_vouchers WHERE ${clauses.join(" OR ")}`)
    .bind(...binds)
    .all<{
      id: string;
      tier: string;
      account_id: string;
      email: string | null;
      status: string;
      vault_order_id: number | null;
    }>();

  const now = new Date().toISOString();
  for (const v of results || []) {
    if (v.status === "pending_vault" || v.status === "claimed") {
      await db
        .prepare(`UPDATE rootmc_pro_vouchers SET status = 'voided', voided_at = ? WHERE id = ?`)
        .bind(now, v.id)
        .run();
      if (v.vault_order_id) {
        try {
          await db
            .prepare(
              `UPDATE rootmc_vault_orders SET status = 'voided', claimed_at = ? WHERE id = ? AND status = 'pending'`,
            )
            .bind(now, v.vault_order_id)
            .run();
        } catch {
          /* ignore */
        }
      }
      continue;
    }
    if (v.status === "redeemed" && v.email) {
      const email = v.email.trim().toLowerCase();
      if (v.tier === "lifetime") {
        await applyStripeBillingRevoke(db, {
          email,
          account_id: v.account_id,
          clear_pro: true,
          clear_life: true,
          subscription_status: "none",
        });
      } else {
        try {
          await db
            .prepare("UPDATE user_accounts SET pro_paid_until = NULL, updated_at = ? WHERE email = ?")
            .bind(now, email)
            .run();
        } catch {
          /* ignore */
        }
      }
      await db
        .prepare(`UPDATE rootmc_pro_vouchers SET status = 'voided', voided_at = ? WHERE id = ?`)
        .bind(now, v.id)
        .run();
    }
  }
}

export { applyStripeBillingPatch };
