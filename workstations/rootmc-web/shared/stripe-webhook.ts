import type { BillingD1 } from "./billing-state";

import { applyStripeBillingPatch, applyStripeBillingRevoke } from "./apply-stripe-billing";
import { ROOTS_ATOMIC_PER_WHOLE } from "./roots-units";
import {
  classifyRootMcPriceId,
  minecraftUsernameFromSession,
  parseRootMcStripePrices,
  purchaserEmailFromSession,
  queueProVoucherToVault,
  resolveBeneficiaryByMinecraftUsername,
  resolveSupportAnnounceIdentity,
  voidOrRevokeVouchersForStripeObject,
  type RootMcStripePrices,
} from "./rootmc-pro-billing";
import { announceSupportPurchase, type SupportAnnounceKind } from "./rootmc-pro-discord-announce";
import {
  activateVisitingHawaiiListing,
  expireVisitingHawaiiListingBySubscription,
  isVisitingHawaiiSponsoredCheckout,
  listingIdFromCheckoutSession,
  refreshVisitingHawaiiListingPeriod,
} from "./visiting-hawaii-sponsored";

export type StripeWebhookEnv = {
  DB: BillingD1;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  /** When set, only apply Pro/Lifetime for this Stripe Product id (e.g. RootMC Pro). */
  STRIPE_ROOTMC_PRODUCT_ID?: string;
  STRIPE_MEMBERSHIP_PRODUCT_ID?: string;
  STRIPE_ROOTMC_PRICE_MONTHLY?: string;
  STRIPE_ROOTMC_PRICE_ONE_MONTH?: string;
  STRIPE_ROOTMC_PRICE_LIFETIME?: string;
  /** Vote Shards Stripe product (pay-to-steer). $1 = 100 shards; Stripe min $0.50. */
  STRIPE_VOTE_SHARDS_PRODUCT_ID?: string;
  STRIPE_VOTE_SHARDS_PRICE_ID?: string;
  ROOTMC_DEFAULT_SERVER_ID?: string;
  DISCORD_ROOTMC_BOT_TOKEN?: string;
  DISCORD_ROOTMC_GENERAL_CHAT_CHANNEL_ID?: string;
  DISCORD_ROOTMC_UPDATES_CHANNEL_ID?: string;
  DISCORD_ROOTMC_ADMINS_CHANNEL_ID?: string;
  DISCORD_ROOTMC_ECONOMY_ANNOUNCE_CHANNEL_ID?: string;
  DISCORD_ROOTMC_INGAME_CHAT_CHANNEL_ID?: string;
};

const ROOTS_CREDIT_PACK_AMOUNT_TOTAL = 300; // $3.00 USD in Stripe's smallest unit.
const ROOTS_CREDIT_PACK_UNITS = 100 * ROOTS_ATOMIC_PER_WHOLE;
const PRO_SHARDS_PER_MONTH = 500;
const LIFETIME_SHARDS_PER_MONTH = 500;

/** HST = UTC-10, no DST. */
function hstYearMonth(d = new Date()): string {
  const utc = d.getTime() + d.getTimezoneOffset() * 60_000;
  const hst = new Date(utc - 10 * 3600_000);
  return `${hst.getUTCFullYear()}-${String(hst.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function creditPaidVoteShardsForAccount(
  db: BillingD1,
  opts: {
    accountId: string;
    minecraftUsername?: string | null;
    id: string;
    kind: string;
    shards: number;
    usd?: number | null;
    note?: string;
  },
): Promise<void> {
  const shards = Math.max(0, Math.floor(Number(opts.shards) || 0));
  const id = String(opts.id || "").trim();
  if (!shards || !id) return;
  let uuid = "";
  try {
    const byAcct = await db
      .prepare(`SELECT minecraft_uuid FROM rootstat_minecraft_links WHERE account_id = ? LIMIT 1`)
      .bind(String(opts.accountId || "").trim())
      .first<{ minecraft_uuid: string }>();
    uuid = String(byAcct?.minecraft_uuid || "").trim().toLowerCase();
    if (!uuid && opts.minecraftUsername) {
      const byName = await db
        .prepare(
          `SELECT minecraft_uuid FROM rootstat_minecraft_links WHERE lower(minecraft_username) = lower(?) LIMIT 1`,
        )
        .bind(String(opts.minecraftUsername).trim())
        .first<{ minecraft_uuid: string }>();
      uuid = String(byName?.minecraft_uuid || "").trim().toLowerCase();
    }
    if (!uuid) return;
    const existing = await db
      .prepare(`SELECT id FROM rootmc_paid_vote_shard_ledger WHERE id = ? LIMIT 1`)
      .bind(id)
      .first<{ id: string }>();
    if (existing?.id) return;
    await db
      .prepare(
        `INSERT INTO rootmc_paid_vote_shard_ledger
           (id, minecraft_uuid, kind, usd, shards, note, include_in_pnl, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, datetime('now'))`,
      )
      .bind(id, uuid, opts.kind, opts.usd ?? null, shards, opts.note || null)
      .run();
    await db
      .prepare(
        `INSERT INTO rootmc_paid_vote_shards (minecraft_uuid, shards, updated_at)
         VALUES (?, ?, datetime('now'))
         ON CONFLICT(minecraft_uuid) DO UPDATE SET
           shards = shards + excluded.shards,
           updated_at = excluded.updated_at`,
      )
      .bind(uuid, shards)
      .run();
  } catch {
    /* table may not exist yet */
  }
}

async function creditLifetimeMonthForAccount(
  db: BillingD1,
  opts: {
    accountId: string;
    minecraftUsername?: string | null;
    sessionId?: string;
  },
): Promise<void> {
  const ym = hstYearMonth();
  let uuid = "";
  try {
    const byAcct = await db
      .prepare(`SELECT minecraft_uuid FROM rootstat_minecraft_links WHERE account_id = ? LIMIT 1`)
      .bind(String(opts.accountId || "").trim())
      .first<{ minecraft_uuid: string }>();
    uuid = String(byAcct?.minecraft_uuid || "").trim().toLowerCase();
    if (!uuid && opts.minecraftUsername) {
      const byName = await db
        .prepare(
          `SELECT minecraft_uuid FROM rootstat_minecraft_links WHERE lower(minecraft_username) = lower(?) LIMIT 1`,
        )
        .bind(String(opts.minecraftUsername).trim())
        .first<{ minecraft_uuid: string }>();
      uuid = String(byName?.minecraft_uuid || "").trim().toLowerCase();
    }
  } catch {
    uuid = "";
  }
  const id = uuid
    ? `lifetime-month:${ym}:${uuid}`
    : `lifetime:${String(opts.sessionId || opts.accountId || "").trim()}`;
  await creditPaidVoteShardsForAccount(db, {
    accountId: opts.accountId,
    minecraftUsername: opts.minecraftUsername,
    id,
    kind: "lifetime-month",
    shards: LIFETIME_SHARDS_PER_MONTH,
    note: `Lifetime · ${LIFETIME_SHARDS_PER_MONTH} vote shards / month · ${ym}`,
  });
}

function usdFromStripeCents(cents: unknown): number | null {
  const n = Number(cents);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n) / 100;
}

async function announceCheckoutIncome(
  env: StripeWebhookEnv,
  kind: SupportAnnounceKind,
  accountId: string | null | undefined,
  fallbackUsername?: string | null,
  details?: { usd?: number | null; shards?: number | null },
): Promise<void> {
  const identity = accountId
    ? await resolveSupportAnnounceIdentity(env.DB, accountId, fallbackUsername)
    : {
        discordUserId: null,
        discordUsername: null,
        minecraftUsername: String(fallbackUsername || "").trim() || null,
      };
  await announceSupportPurchase(env, kind, identity, details);
}

function whJson(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) x |= a[i]! ^ b[i]!;
  return x === 0;
}

function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += bytes[i]!.toString(16).padStart(2, "0");
  return out;
}

async function verifyStripeSignature(
  payload: string,
  sigHeader: string,
  whsec: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!sigHeader.trim()) return { ok: false, reason: "missing_stripe_signature" };

  const secret = whsec.trim().replace(/\r/g, "").replace(/^["']|["']$/g, "");
  if (!secret.startsWith("whsec_")) return { ok: false, reason: "missing_whsec" };

  const parts = sigHeader.split(",").map((s) => s.trim());
  let t = "";
  const v1s: string[] = [];
  for (const p of parts) {
    if (p.startsWith("t=")) t = p.slice(2);
    else if (p.startsWith("v1=")) v1s.push(p.slice(3));
  }
  if (!t || !v1s.length) return { ok: false, reason: "malformed_stripe_signature" };

  const ts = Number(t) * 1000;
  // Allow delayed retries / clock skew (Stripe may resend over hours).
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > 72 * 60 * 60 * 1000) {
    return { ok: false, reason: "stripe_timestamp_outside_tolerance" };
  }

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = `${t}.${payload}`;
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(signed)));
  const macHex = bytesToHex(mac);
  const macBytes = enc.encode(macHex);
  for (const v1 of v1s) {
    const expectedHex = v1.toLowerCase();
    if (!expectedHex || expectedHex.length !== macHex.length) continue;
    if (timingSafeEqual(macBytes, enc.encode(expectedHex))) return { ok: true };
  }
  return { ok: false, reason: "stripe_hmac_mismatch" };
}

async function stripeGet(secret: string, path: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { Authorization: `Bearer ${secret.trim()}` },
  });
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) return null;
  return data;
}

function membershipProductFilter(env: StripeWebhookEnv): string {
  return String(env.STRIPE_ROOTMC_PRODUCT_ID || env.STRIPE_MEMBERSHIP_PRODUCT_ID || "").trim();
}

function productIdFromPrice(price: unknown): string {
  if (!price || typeof price !== "object") return "";
  const p = price as Record<string, unknown>;
  const prod = p.product;
  if (typeof prod === "string") return prod.trim();
  if (prod && typeof prod === "object" && typeof (prod as { id?: unknown }).id === "string") {
    return String((prod as { id: string }).id).trim();
  }
  return "";
}

function collectProductIdsFromLineItems(lineItems: unknown): string[] {
  const out: string[] = [];
  if (!lineItems || typeof lineItems !== "object") return out;
  const data = (lineItems as { data?: unknown[] }).data;
  if (!Array.isArray(data)) return out;
  for (const row of data) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const fromPrice = productIdFromPrice(r.price);
    if (fromPrice) out.push(fromPrice);
    if (typeof r.price === "string") {
      /* unresolved price id — ignore */
    }
  }
  return out;
}

async function objectIncludesMembershipProduct(
  secret: string,
  obj: Record<string, unknown>,
  productFilter: string,
): Promise<boolean> {
  if (!productFilter) return true;

  const direct = collectProductIdsFromLineItems(obj.line_items);
  if (direct.includes(productFilter)) return true;

  const items = obj.items;
  if (items) {
    const fromItems = collectProductIdsFromLineItems(items);
    if (fromItems.includes(productFilter)) return true;
  }

  const sessionId = typeof obj.id === "string" && obj.id.startsWith("cs_") ? obj.id : "";
  if (sessionId && secret.trim().startsWith("sk_")) {
    const expanded = await stripeGet(
      secret,
      `/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=line_items.data.price.product`,
    );
    if (expanded) {
      const ids = collectProductIdsFromLineItems(expanded.line_items);
      if (ids.includes(productFilter)) return true;
    }
  }

  const subId = typeof obj.id === "string" && obj.id.startsWith("sub_") ? obj.id : "";
  if (subId && secret.trim().startsWith("sk_")) {
    const expanded = await stripeGet(
      secret,
      `/subscriptions/${encodeURIComponent(subId)}?expand[]=items.data.price.product`,
    );
    if (expanded) {
      const ids = collectProductIdsFromLineItems(expanded.items);
      if (ids.includes(productFilter)) return true;
    }
  }

  return false;
}

async function resolvePortalUserByCustomerEmail(
  db: BillingD1,
  secret: string,
  customerId: string
): Promise<{ accountId: string; email: string } | null> {
  if (!secret.trim().startsWith("sk_")) return null;
  if (!customerId.trim().startsWith("cus_")) return null;
  const c = await stripeGet(secret, `/customers/${encodeURIComponent(customerId)}`);
  const em = typeof c?.email === "string" ? c.email.trim().toLowerCase() : "";
  if (!em) return null;
  return resolvePortalUserByEmail(db, em);
}

async function resolvePortalUserByEmail(
  db: BillingD1,
  email: string
): Promise<{ accountId: string; email: string } | null> {
  const em = email.trim().toLowerCase();
  if (!em) return null;

  const ua = await db
    .prepare("SELECT account_id, email FROM user_accounts WHERE email = ?")
    .bind(em)
    .first<{ account_id: string | null; email: string }>();
  if (ua?.email) {
    const aid = String(ua.account_id || "").trim();
    if (aid) return { accountId: aid, email: ua.email.trim().toLowerCase() };
  }

  const lic = await db
    .prepare("SELECT id, email FROM license_accounts WHERE email = ?")
    .bind(em)
    .first<{ id: string; email: string }>();
  if (lic?.email) return { accountId: lic.id, email: lic.email.trim().toLowerCase() };

  const link = await db
    .prepare(
      `SELECT dal.account_id AS account_id, la.email AS email
       FROM discord_account_links dal
       JOIN license_accounts la ON la.id = dal.account_id
       WHERE lower(la.email) = ?
       LIMIT 1`
    )
    .bind(em)
    .first<{ account_id: string; email: string }>();
  if (link?.email && link.account_id) {
    return { accountId: link.account_id, email: link.email.trim().toLowerCase() };
  }

  return null;
}

async function insertWebhookEventOnce(db: BillingD1, id: string): Promise<boolean> {
  const now = new Date().toISOString();
  const r = await db.prepare("INSERT OR IGNORE INTO stripe_webhook_events (id, received_at) VALUES (?, ?)").bind(id, now).run();
  return (r.meta?.rows_written ?? 0) > 0;
}

async function insertBillingAudit(
  db: BillingD1,
  row: {
    event_type: string;
    stripe_object_id: string | null;
    email: string | null;
    account_id: string | null;
    action: string;
    detail: Record<string, unknown>;
  }
): Promise<void> {
  const now = new Date().toISOString();
  try {
    await db
      .prepare(
        `INSERT INTO stripe_billing_audit
           (id, event_type, stripe_object_id, email, account_id, action, detail_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        crypto.randomUUID(),
        row.event_type,
        row.stripe_object_id,
        row.email,
        row.account_id,
        row.action,
        JSON.stringify(row.detail),
        now,
      )
      .run();
  } catch (e) {
    console.warn(
      "stripe_billing_audit insert failed",
      String(e && typeof e === "object" && "message" in e ? (e as Error).message : e),
    );
  }
}

async function resolvePortalUser(
  db: BillingD1,
  session: Record<string, unknown>
): Promise<{ accountId: string; email: string } | null> {
  const ref = String(session.client_reference_id || "").trim();
  const det = session.customer_details as Record<string, unknown> | undefined;
  const em = typeof det?.email === "string" ? det.email.trim().toLowerCase() : "";
  if (ref) {
    const row = await db
      .prepare("SELECT id, email FROM license_accounts WHERE id = ?")
      .bind(ref)
      .first<{ id: string; email: string }>();
    if (row?.email) return { accountId: row.id, email: row.email.trim().toLowerCase() };
  }
  if (em) {
    return resolvePortalUserByEmail(db, em);
  }
  return null;
}

async function ensureRootsBalance(db: BillingD1, userId: string, nowIso: string): Promise<void> {
  await db
    .prepare("INSERT OR IGNORE INTO rr_earn_balance (user_id, balance, updated_at) VALUES (?, 0, ?)")
    .bind(userId, nowIso)
    .run();
}

async function creditRootsPack(db: BillingD1, user: { email: string }): Promise<void> {
  const email = user.email.trim().toLowerCase();
  if (!email) return;
  const userId = `user:${email}`;
  const nowIso = new Date().toISOString();
  await ensureRootsBalance(db, userId, nowIso);
  await db
    .prepare("UPDATE rr_earn_balance SET balance = balance + ?, updated_at = ? WHERE user_id = ?")
    .bind(ROOTS_CREDIT_PACK_UNITS, nowIso, userId)
    .run();
}

function isRootsCreditPackCheckout(session: Record<string, unknown>): boolean {
  const mode = String(session.mode || "");
  const currency = String(session.currency || "").toLowerCase();
  const amountTotal = Math.floor(Number(session.amount_total) || 0);
  const paymentStatus = String(session.payment_status || "").toLowerCase();
  return mode === "payment" && currency === "usd" && amountTotal === ROOTS_CREDIT_PACK_AMOUNT_TOTAL && paymentStatus === "paid";
}

async function resolvePortalUserByCustomer(
  db: BillingD1,
  customerId: string
): Promise<{ accountId: string; email: string } | null> {
  const row = await db
    .prepare("SELECT account_id, email FROM user_accounts WHERE stripe_customer_id = ?")
    .bind(customerId)
    .first<{ account_id: string | null; email: string }>();
  if (!row?.email) return null;
  const aid = String(row.account_id || "").trim();
  if (!aid) return null;
  return { accountId: aid, email: row.email.trim().toLowerCase() };
}

async function resolvePortalUserBySubscription(
  db: BillingD1,
  subscriptionId: string
): Promise<{ accountId: string; email: string } | null> {
  const row = await db
    .prepare("SELECT account_id, email FROM user_accounts WHERE stripe_subscription_id = ?")
    .bind(subscriptionId)
    .first<{ account_id: string | null; email: string }>();
  if (!row?.email) return null;
  const aid = String(row.account_id || "").trim();
  if (!aid) return null;
  return { accountId: aid, email: row.email.trim().toLowerCase() };
}

function paidSubscriptionStatuses(): Set<string> {
  return new Set(["active", "trialing"]);
}

function stripeCustomerId(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object" && typeof (raw as { id?: unknown }).id === "string") {
    return (raw as { id: string }).id;
  }
  return "";
}

function subscriptionPeriodEndIso(sub: Record<string, unknown> | null): string | null {
  if (!sub) return null;
  const end = Number(sub.current_period_end);
  if (!Number.isFinite(end) || end <= 0) return null;
  return new Date(end * 1000).toISOString();
}

async function onVisitingHawaiiSponsoredCheckout(
  db: BillingD1,
  secret: string,
  session: Record<string, unknown>,
): Promise<void> {
  const listingId = listingIdFromCheckoutSession(session);
  if (!listingId) return;

  const cust = stripeCustomerId(session.customer) || null;
  const subscription = typeof session.subscription === "string" ? session.subscription : null;
  const sessionId = typeof session.id === "string" ? session.id : null;
  let paidThrough: string | null = null;
  if (subscription) {
    const sub = await stripeGet(secret, `/subscriptions/${encodeURIComponent(subscription)}`);
    paidThrough = subscriptionPeriodEndIso(sub);
  }
  if (!paidThrough) {
    const d = new Date();
    d.setUTCFullYear(d.getUTCFullYear() + 1);
    paidThrough = d.toISOString();
  }

  await activateVisitingHawaiiListing(db, listingId, {
    stripeCustomerId: cust,
    stripeSubscriptionId: subscription,
    stripeCheckoutSessionId: sessionId,
    paidThroughIso: paidThrough,
  });
}

function collectPriceIdsFromLineItems(lineItems: unknown): string[] {
  const out: string[] = [];
  if (!lineItems || typeof lineItems !== "object") return out;
  const data = (lineItems as { data?: unknown[] }).data;
  if (!Array.isArray(data)) return out;
  for (const row of data) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const price = r.price;
    if (typeof price === "string" && price.startsWith("price_")) out.push(price);
    if (price && typeof price === "object" && typeof (price as { id?: unknown }).id === "string") {
      const id = String((price as { id: string }).id);
      if (id.startsWith("price_")) out.push(id);
    }
  }
  return out;
}

async function sessionPriceIds(secret: string, session: Record<string, unknown>): Promise<string[]> {
  const direct = collectPriceIdsFromLineItems(session.line_items);
  if (direct.length) return direct;
  const sessionId = typeof session.id === "string" && session.id.startsWith("cs_") ? session.id : "";
  if (!sessionId || !secret.trim().startsWith("sk_")) return [];
  const expanded = await stripeGet(
    secret,
    `/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=line_items.data.price`,
  );
  return collectPriceIdsFromLineItems(expanded?.line_items);
}

async function resolveRootMcCheckoutUser(
  db: BillingD1,
  secret: string,
  session: Record<string, unknown>,
): Promise<{ accountId: string; email: string; minecraftUuid: string | null; minecraftUsername: string | null } | null> {
  const ign = minecraftUsernameFromSession(session);
  if (ign) {
    const byName = await resolveBeneficiaryByMinecraftUsername(db, ign);
    if (byName) return byName;
  }
  const emailUser = await resolvePortalUser(db, session);
  if (!emailUser) return null;
  return {
    accountId: emailUser.accountId,
    email: emailUser.email,
    minecraftUuid: null,
    minecraftUsername: ign || null,
  };
}

function voteShardsProductId(env: StripeWebhookEnv): string {
  return String(env.STRIPE_VOTE_SHARDS_PRODUCT_ID || "").trim();
}

function voteShardsPriceId(env: StripeWebhookEnv): string {
  return String(env.STRIPE_VOTE_SHARDS_PRICE_ID || "").trim();
}

function sessionLooksLikeVoteShards(session: Record<string, unknown>): boolean {
  const meta = session.metadata as Record<string, unknown> | undefined;
  const kind = String(meta?.kind || meta?.product || "").toLowerCase().replace(/[\s-]+/g, "_");
  return kind === "vote_shards" || kind === "voteshards";
}

/** $1 = 100 shards → 1¢ = 1 shard. Stripe USD floor is $0.50 = 50 shards. */
function shardsFromStripeCents(cents: unknown): number {
  return Math.max(0, Math.round(Number(cents) || 0));
}

async function isVoteShardsCheckout(
  secret: string,
  session: Record<string, unknown>,
  env: StripeWebhookEnv,
): Promise<boolean> {
  if (sessionLooksLikeVoteShards(session)) return true;
  const priceId = voteShardsPriceId(env);
  if (priceId) {
    const prices = await sessionPriceIds(secret, session);
    if (prices.includes(priceId)) return true;
  }
  const productId = voteShardsProductId(env);
  if (productId && (await objectIncludesMembershipProduct(secret, session, productId))) {
    return true;
  }
  return false;
}

async function fulfillVoteShardsCheckout(
  env: StripeWebhookEnv,
  secret: string,
  session: Record<string, unknown>,
): Promise<void> {
  const db = env.DB;
  const sessionId = typeof session.id === "string" ? session.id : "";
  let cents = shardsFromStripeCents(session.amount_total);
  if (!cents && sessionId && secret.trim().startsWith("sk_")) {
    const expanded = await stripeGet(
      secret,
      `/checkout/sessions/${encodeURIComponent(sessionId)}`,
    );
    cents = shardsFromStripeCents(expanded?.amount_total);
  }
  if (!sessionId || !cents) return;
  const beneficiary = await resolveRootMcCheckoutUser(db, secret, session);
  if (beneficiary) {
    await creditPaidVoteShardsForAccount(db, {
      accountId: beneficiary.accountId,
      minecraftUsername: beneficiary.minecraftUsername,
      id: `vote-shards:${sessionId}`,
      kind: "stripe",
      shards: cents,
      usd: cents / 100,
      note: `Stripe Vote Shards · $${(cents / 100).toFixed(2)} → ${cents} shards`,
    });
  } else {
    console.warn("vote shards checkout: could not resolve minecraft username or email");
  }
  await announceCheckoutIncome(
    env,
    "vote_shards",
    beneficiary?.accountId,
    beneficiary?.minecraftUsername,
    { usd: cents / 100, shards: cents },
  );
}

async function onCheckoutSessionCompleted(
  env: StripeWebhookEnv,
  secret: string,
  session: Record<string, unknown>,
  productFilter: string,
  rootMcPrices: RootMcStripePrices,
): Promise<void> {
  const db = env.DB;
  if (isVisitingHawaiiSponsoredCheckout(session)) {
    const paymentStatus = String(session.payment_status || "").toLowerCase();
    if (paymentStatus && paymentStatus !== "paid" && paymentStatus !== "no_payment_required") return;
    await onVisitingHawaiiSponsoredCheckout(db, secret, session);
    return;
  }

  const mode = String(session.mode || "");
  const cust = stripeCustomerId(session.customer);
  const customer = cust || null;
  const subscription = typeof session.subscription === "string" ? session.subscription : null;
  const sessionId = typeof session.id === "string" ? session.id : null;
  const paymentIntent = typeof session.payment_intent === "string" ? session.payment_intent : null;

  if (mode === "payment") {
    const paymentStatus = String(session.payment_status || "").toLowerCase();
    if (
      (!paymentStatus || paymentStatus === "paid" || paymentStatus === "no_payment_required") &&
      (await isVoteShardsCheckout(secret, session, env))
    ) {
      await fulfillVoteShardsCheckout(env, secret, session);
      return;
    }
  }

  const hasRootMcPrices = Boolean(rootMcPrices.monthly || rootMcPrices.oneMonth || rootMcPrices.lifetime);
  if (hasRootMcPrices && productFilter) {
    if (!(await objectIncludesMembershipProduct(secret, session, productFilter))) {
      // Fall through only for non-RootMC products (e.g. Roots pack)
      if (mode === "payment" && isRootsCreditPackCheckout(session)) {
        const user = await resolvePortalUser(db, session);
        if (user) await creditRootsPack(db, user);
      }
      return;
    }

    const priceIds = await sessionPriceIds(secret, session);
    let kind: ReturnType<typeof classifyRootMcPriceId> = null;
    for (const pid of priceIds) {
      kind = classifyRootMcPriceId(pid, rootMcPrices);
      if (kind) break;
    }
    // Legacy: payment with product but unknown price id → lifetime voucher if lifetime price unset
    if (!kind && mode === "payment") kind = rootMcPrices.lifetime ? null : "lifetime";
    if (!kind && mode === "subscription") kind = "subscription";
    if (!kind) return;

    const beneficiary = await resolveRootMcCheckoutUser(db, secret, session);
    const checkoutUsd = usdFromStripeCents(session.amount_total);
    if (!beneficiary) {
      console.warn("rootmc stripe checkout: could not resolve minecraft username or email");
      const announceKind: SupportAnnounceKind =
        kind === "subscription" ? "sub_first" : kind === "lifetime" ? "lifetime" : "one_month";
      await announceCheckoutIncome(env, announceKind, null, minecraftUsernameFromSession(session), {
        usd: checkoutUsd,
      });
      return;
    }
    const purchaserEmail = purchaserEmailFromSession(session) || null;

    if (kind === "subscription" && subscription) {
      const sub = await stripeGet(secret, `/subscriptions/${encodeURIComponent(subscription)}`);
      const st = typeof sub?.status === "string" ? sub.status : "active";
      const pro = paidSubscriptionStatuses().has(st);
      await applyStripeBillingPatch(db, {
        email: beneficiary.email,
        account_id: beneficiary.accountId,
        stripe_customer_id: customer,
        stripe_subscription_id: subscription,
        subscription_status: st,
        pro_unlocked: pro,
        life_member: false,
      });
      await insertBillingAudit(db, {
        event_type: "checkout.session.completed",
        stripe_object_id: sessionId,
        email: beneficiary.email,
        account_id: beneficiary.accountId,
        action: "grant_subscription_pro",
        detail: {
          minecraft_username: beneficiary.minecraftUsername,
          purchaser_email: purchaserEmail,
          mode,
          subscription_id: subscription,
        },
      });
      await announceCheckoutIncome(env, "sub_first", beneficiary.accountId, beneficiary.minecraftUsername, {
        usd: checkoutUsd,
      });
      return;
    }

    if (kind === "one_month" || kind === "lifetime") {
      await queueProVoucherToVault(db, {
        tier: kind,
        beneficiary,
        purchaserEmail,
        serverId: rootMcPrices.defaultServerId || "rootmc",
        stripeCheckoutSessionId: sessionId,
        stripePaymentIntent: paymentIntent,
        stripeChargeId: null,
      });
      await insertBillingAudit(db, {
        event_type: "checkout.session.completed",
        stripe_object_id: sessionId,
        email: beneficiary.email,
        account_id: beneficiary.accountId,
        action: kind === "lifetime" ? "queue_life_voucher" : "queue_month_voucher",
        detail: {
          minecraft_username: beneficiary.minecraftUsername,
          purchaser_email: purchaserEmail,
          mode,
        },
      });
      await announceCheckoutIncome(
        env,
        kind === "lifetime" ? "lifetime" : "one_month",
        beneficiary.accountId,
        beneficiary.minecraftUsername,
        {
          usd: checkoutUsd,
          shards: kind === "lifetime" ? LIFETIME_SHARDS_PER_MONTH : PRO_SHARDS_PER_MONTH,
        },
      );
      if (kind === "lifetime") {
        await creditLifetimeMonthForAccount(db, {
          accountId: beneficiary.accountId,
          minecraftUsername: beneficiary.minecraftUsername,
          sessionId,
        });
      } else {
        await creditPaidVoteShardsForAccount(db, {
          accountId: beneficiary.accountId,
          minecraftUsername: beneficiary.minecraftUsername,
          id: `pro-month:${sessionId}`,
          kind: "pro-month",
          shards: PRO_SHARDS_PER_MONTH,
          note: "Paid one-month Pro · 500 vote shards",
        });
      }
      return;
    }
  }

  const user = await resolvePortalUser(db, session);
  if (!user) return;

  if (mode === "payment") {
    if (isRootsCreditPackCheckout(session)) {
      await creditRootsPack(db, user);
      return;
    }
    if (!(await objectIncludesMembershipProduct(secret, session, productFilter))) return;
    await applyStripeBillingPatch(db, {
      email: user.email,
      account_id: user.accountId,
      stripe_customer_id: customer,
      stripe_subscription_id: null,
      subscription_status: "none",
      pro_unlocked: true,
      life_member: true,
    });
    await creditLifetimeMonthForAccount(db, {
      accountId: user.accountId,
      sessionId,
    });
    await announceCheckoutIncome(env, "lifetime", user.accountId, null, {
      usd: usdFromStripeCents(session.amount_total),
      shards: LIFETIME_SHARDS_PER_MONTH,
    });
    return;
  }

  if (mode === "subscription" && subscription) {
    if (!(await objectIncludesMembershipProduct(secret, session, productFilter))) return;
    const sub = await stripeGet(secret, `/subscriptions/${encodeURIComponent(subscription)}`);
    const st = typeof sub?.status === "string" ? sub.status : "active";
    const pro = paidSubscriptionStatuses().has(st);
    await applyStripeBillingPatch(db, {
      email: user.email,
      account_id: user.accountId,
      stripe_customer_id: customer,
      stripe_subscription_id: subscription,
      subscription_status: st,
      pro_unlocked: pro,
      life_member: false,
    });
    if (pro) {
      await announceCheckoutIncome(env, "sub_first", user.accountId, null, {
        usd: usdFromStripeCents(session.amount_total),
      });
    }
  }
}

async function onSubscriptionUpdated(
  db: BillingD1,
  secret: string,
  sub: Record<string, unknown>,
  productFilter: string,
): Promise<void> {
  const id = typeof sub.id === "string" ? sub.id : "";
  const customer = stripeCustomerId(sub.customer);
  if (!id) return;

  const meta = sub.metadata as Record<string, unknown> | undefined;
  if (String(meta?.product || "") === "visiting_hawaii_sponsored") {
    const paidThrough = subscriptionPeriodEndIso(sub);
    if (paidThrough && paidSubscriptionStatuses().has(String(sub.status || ""))) {
      await refreshVisitingHawaiiListingPeriod(db, id, paidThrough);
    }
    return;
  }

  if (!(await objectIncludesMembershipProduct(secret, sub, productFilter))) return;

  let user = await resolvePortalUserBySubscription(db, id);
  if (!user && customer) user = await resolvePortalUserByCustomer(db, customer);
  if (!user && customer) user = await resolvePortalUserByCustomerEmail(db, secret, customer);
  if (!user) return;

  const st = typeof sub.status === "string" ? sub.status : "unknown";
  const pro = paidSubscriptionStatuses().has(st);
  await applyStripeBillingPatch(db, {
    email: user.email,
    account_id: user.accountId,
    stripe_customer_id: customer || null,
    stripe_subscription_id: id,
    subscription_status: st,
    pro_unlocked: pro,
    life_member: false,
  });
}

async function onSubscriptionDeleted(db: BillingD1, sub: Record<string, unknown>): Promise<void> {
  const id = typeof sub.id === "string" ? sub.id : "";
  const customer = stripeCustomerId(sub.customer);
  if (!id) return;

  const meta = sub.metadata as Record<string, unknown> | undefined;
  if (String(meta?.product || "") === "visiting_hawaii_sponsored") {
    await expireVisitingHawaiiListingBySubscription(db, id);
    return;
  }

  let user = await resolvePortalUserBySubscription(db, id);
  if (!user && customer) user = await resolvePortalUserByCustomer(db, customer);
  if (!user) return;

  const cur = await db
    .prepare("SELECT life_member FROM user_accounts WHERE email = ?")
    .bind(user.email)
    .first<{ life_member: number | null }>();
  const life = cur?.life_member === 1;
  await applyStripeBillingPatch(db, {
    email: user.email,
    account_id: user.accountId,
    stripe_customer_id: customer || null,
    stripe_subscription_id: null,
    subscription_status: "canceled",
    pro_unlocked: life,
    life_member: life,
  });
}

async function onInvoiceEvent(
  env: StripeWebhookEnv,
  secret: string,
  invoice: Record<string, unknown>,
  paid: boolean,
  productFilter: string,
): Promise<void> {
  const db = env.DB;
  const subId = typeof invoice.subscription === "string" ? invoice.subscription : "";
  if (!subId) return;
  if (productFilter) {
    const sub = await stripeGet(secret, `/subscriptions/${encodeURIComponent(subId)}`);
    if (!sub || !(await objectIncludesMembershipProduct(secret, sub, productFilter))) return;
  }
  let user = await resolvePortalUserBySubscription(db, subId);
  const customer = stripeCustomerId(invoice.customer);
  if (!user && customer) user = await resolvePortalUserByCustomer(db, customer);
  if (!user && customer) user = await resolvePortalUserByCustomerEmail(db, secret, customer);
  if (!user) return;

  const sub = await stripeGet(secret, `/subscriptions/${encodeURIComponent(subId)}`);
  const st = typeof sub?.status === "string" ? sub.status : paid ? "active" : "past_due";
  const pro = paidSubscriptionStatuses().has(st);
  await applyStripeBillingPatch(db, {
    email: user.email,
    account_id: user.accountId,
    stripe_customer_id: stripeCustomerId(invoice.customer) || null,
    stripe_subscription_id: subId,
    subscription_status: st,
    pro_unlocked: pro,
    life_member: false,
  });

  // Renewals only (first checkout announces on checkout.session.completed).
  if (paid && pro) {
    const reason = String(invoice.billing_reason || "").toLowerCase();
    if (reason === "subscription_cycle") {
      await announceCheckoutIncome(env, "sub_renew", user.accountId, null, {
        usd: usdFromStripeCents(invoice.amount_paid ?? invoice.total),
      });
    }
    const invoiceId = typeof invoice.id === "string" ? invoice.id : "";
    if (
      invoiceId &&
      (reason === "subscription_cycle" || reason === "subscription_create")
    ) {
      await creditPaidVoteShardsForAccount(db, {
        accountId: user.accountId,
        id: `pro-month:${invoiceId}`,
        kind: "pro-month",
        shards: PRO_SHARDS_PER_MONTH,
        note: "Paid Pro invoice · 500 vote shards / month",
      });
    }
  }
}

type ChargeKind = "subscription" | "life_payment" | "unknown";

async function classifyCharge(
  secret: string,
  charge: Record<string, unknown>,
  productFilter: string,
): Promise<{ kind: ChargeKind; customerId: string; invoiceId: string }> {
  const customerId = stripeCustomerId(charge.customer);
  const invoiceId = typeof charge.invoice === "string" ? charge.invoice : "";
  if (invoiceId) {
    if (productFilter) {
      const inv = await stripeGet(secret, `/invoices/${encodeURIComponent(invoiceId)}`);
      const subId = typeof inv?.subscription === "string" ? inv.subscription : "";
      if (subId) {
        const sub = await stripeGet(secret, `/subscriptions/${encodeURIComponent(subId)}`);
        if (sub && (await objectIncludesMembershipProduct(secret, sub, productFilter))) {
          return { kind: "subscription", customerId, invoiceId };
        }
        return { kind: "unknown", customerId, invoiceId };
      }
    }
    return { kind: "subscription", customerId, invoiceId };
  }

  // One-time Payment Link / Checkout (Lifetime).
  const pi = typeof charge.payment_intent === "string" ? charge.payment_intent : "";
  if (pi && secret.trim().startsWith("sk_")) {
    const sessions = await stripeGet(
      secret,
      `/checkout/sessions?payment_intent=${encodeURIComponent(pi)}&limit=1`,
    );
    const data = sessions?.data;
    if (Array.isArray(data) && data[0] && typeof data[0] === "object") {
      const session = data[0] as Record<string, unknown>;
      if (String(session.mode || "") === "payment") {
        if (await objectIncludesMembershipProduct(secret, session, productFilter)) {
          return { kind: "life_payment", customerId, invoiceId };
        }
        return { kind: "unknown", customerId, invoiceId };
      }
    }
  }

  // Fallback: if filter unset and no invoice, treat as life one-time (legacy Roots-adjacent).
  if (!productFilter) return { kind: "life_payment", customerId, invoiceId };
  return { kind: "unknown", customerId, invoiceId };
}

async function resolveUserForCharge(
  db: BillingD1,
  secret: string,
  charge: Record<string, unknown>,
  customerId: string,
): Promise<{ accountId: string; email: string } | null> {
  let user: { accountId: string; email: string } | null = null;
  if (customerId) user = await resolvePortalUserByCustomer(db, customerId);
  if (!user && customerId) user = await resolvePortalUserByCustomerEmail(db, secret, customerId);
  const bil = charge.billing_details as Record<string, unknown> | undefined;
  const em = typeof bil?.email === "string" ? bil.email.trim().toLowerCase() : "";
  if (!user && em) user = await resolvePortalUserByEmail(db, em);
  return user;
}

async function revokeForCharge(
  db: BillingD1,
  secret: string,
  charge: Record<string, unknown>,
  eventType: string,
  productFilter: string,
): Promise<void> {
  const chargeId = typeof charge.id === "string" ? charge.id : "";
  const paymentIntent = typeof charge.payment_intent === "string" ? charge.payment_intent : null;
  const classified = await classifyCharge(secret, charge, productFilter);
  if (classified.kind === "unknown") return;

  // Prefer voiding tradeable vouchers (unclaimed / claimed / redeemed) when present.
  await voidOrRevokeVouchersForStripeObject(db, {
    chargeId: chargeId || null,
    paymentIntent,
    sessionId: null,
  });

  const user = await resolveUserForCharge(db, secret, charge, classified.customerId);
  if (!user) return;

  const clearLife = classified.kind === "life_payment";
  const clearPro = true;

  if (classified.kind === "subscription") {
    await applyStripeBillingRevoke(db, {
      email: user.email,
      account_id: user.accountId,
      clear_pro: clearPro,
      clear_life: false,
      stripe_customer_id: classified.customerId || null,
      stripe_subscription_id: null,
      subscription_status: "canceled",
    });
  } else {
    // One-time: voucher path already cleared entitlements if redeemed; still clear life if legacy direct grant.
    await applyStripeBillingRevoke(db, {
      email: user.email,
      account_id: user.accountId,
      clear_pro: clearPro,
      clear_life: clearLife,
      stripe_customer_id: classified.customerId || null,
      stripe_subscription_id: undefined,
      subscription_status: undefined,
    });
    try {
      await db
        .prepare("UPDATE user_accounts SET pro_paid_until = NULL, updated_at = ? WHERE email = ?")
        .bind(new Date().toISOString(), user.email)
        .run();
    } catch {
      /* ignore */
    }
  }

  await insertBillingAudit(db, {
    event_type: eventType,
    stripe_object_id: chargeId || null,
    email: user.email,
    account_id: user.accountId,
    action: clearLife ? "revoke_life" : "revoke_pro",
    detail: {
      kind: classified.kind,
      invoice_id: classified.invoiceId || null,
      customer_id: classified.customerId || null,
    },
  });
}

async function restoreForDisputeWon(
  db: BillingD1,
  secret: string,
  dispute: Record<string, unknown>,
  productFilter: string,
): Promise<void> {
  const chargeRef = dispute.charge;
  const chargeId = typeof chargeRef === "string" ? chargeRef : stripeCustomerId(chargeRef);
  if (!chargeId.startsWith("ch_") && !chargeId.startsWith("py_")) return;

  const charge = await stripeGet(secret, `/charges/${encodeURIComponent(chargeId)}`);
  if (!charge) return;

  const classified = await classifyCharge(secret, charge, productFilter);
  if (classified.kind === "unknown") return;

  const user = await resolveUserForCharge(db, secret, charge, classified.customerId);
  if (!user) return;

  if (classified.kind === "life_payment") {
    await applyStripeBillingPatch(db, {
      email: user.email,
      account_id: user.accountId,
      stripe_customer_id: classified.customerId || null,
      stripe_subscription_id: null,
      subscription_status: "none",
      pro_unlocked: true,
      life_member: true,
    });
    await insertBillingAudit(db, {
      event_type: "charge.dispute.closed",
      stripe_object_id: chargeId,
      email: user.email,
      account_id: user.accountId,
      action: "restore_life",
      detail: { status: "won", kind: classified.kind },
    });
    return;
  }

  // Subscription charge dispute won — restore Pro if subscription still paid.
  const invId = classified.invoiceId;
  let subId = "";
  if (invId) {
    const inv = await stripeGet(secret, `/invoices/${encodeURIComponent(invId)}`);
    subId = typeof inv?.subscription === "string" ? inv.subscription : "";
  }
  let st = "active";
  if (subId) {
    const sub = await stripeGet(secret, `/subscriptions/${encodeURIComponent(subId)}`);
    st = typeof sub?.status === "string" ? sub.status : "active";
  }
  const pro = paidSubscriptionStatuses().has(st);
  await applyStripeBillingPatch(db, {
    email: user.email,
    account_id: user.accountId,
    stripe_customer_id: classified.customerId || null,
    stripe_subscription_id: subId || null,
    subscription_status: st,
    pro_unlocked: pro,
    life_member: false,
  });
  await insertBillingAudit(db, {
    event_type: "charge.dispute.closed",
    stripe_object_id: chargeId,
    email: user.email,
    account_id: user.accountId,
    action: "restore_pro",
    detail: { status: "won", kind: classified.kind, subscription_status: st },
  });
}

async function onDisputeEvent(
  db: BillingD1,
  secret: string,
  dispute: Record<string, unknown>,
  eventType: string,
  productFilter: string,
): Promise<void> {
  if (eventType === "charge.dispute.closed") {
    const status = String(dispute.status || "").toLowerCase();
    if (status === "won") {
      await restoreForDisputeWon(db, secret, dispute, productFilter);
    }
    // lost / warning_closed — revoke already handled on created / funds_withdrawn
    return;
  }

  const chargeRef = dispute.charge;
  const chargeId = typeof chargeRef === "string" ? chargeRef : stripeCustomerId(chargeRef);
  if (!chargeId) return;
  const charge = await stripeGet(secret, `/charges/${encodeURIComponent(chargeId)}`);
  if (!charge) return;
  await revokeForCharge(db, secret, charge, eventType, productFilter);
}

async function onChargeRefunded(
  db: BillingD1,
  secret: string,
  charge: Record<string, unknown>,
  productFilter: string,
): Promise<void> {
  const refunded = charge.refunded === true;
  const amountRefunded = Math.floor(Number(charge.amount_refunded) || 0);
  const amount = Math.floor(Number(charge.amount) || 0);
  if (!refunded && !(amount > 0 && amountRefunded >= amount)) return;
  await revokeForCharge(db, secret, charge, "charge.refunded", productFilter);
}

export async function handleStripeWebhook(request: Request, env: StripeWebhookEnv): Promise<Response> {
  const whsec = (env.STRIPE_WEBHOOK_SECRET || "").trim();
  const sk = (env.STRIPE_SECRET_KEY || "").trim();
  if (!whsec.startsWith("whsec_")) {
    return whJson({ detail: "STRIPE_WEBHOOK_SECRET not configured." }, 503);
  }

  const sig = request.headers.get("Stripe-Signature") || "";
  const payload = await request.text();
  const v = await verifyStripeSignature(payload, sig, whsec);
  if (!v.ok) {
    return whJson({ detail: "Invalid signature.", reason: v.reason }, 400);
  }

  let evt: { id?: string; type?: string; data?: { object?: Record<string, unknown> } };
  try {
    evt = JSON.parse(payload) as typeof evt;
  } catch {
    return whJson({ detail: "Invalid JSON." }, 400);
  }

  const id = String(evt.id || "");
  const type = String(evt.type || "");
  if (!id || !type) return whJson({ detail: "Missing event id or type." }, 400);

  const inserted = await insertWebhookEventOnce(env.DB, id);
  if (!inserted) {
    return whJson({ received: true, duplicate: true }, 200);
  }

  const obj = evt.data?.object;
  if (!obj || typeof obj !== "object") {
    return whJson({ received: true }, 200);
  }

  const productFilter = membershipProductFilter(env);
  const rootMcPrices = parseRootMcStripePrices(env);

  try {
    if (type === "checkout.session.completed") {
      if (sk.startsWith("sk_")) await onCheckoutSessionCompleted(env, sk, obj, productFilter, rootMcPrices);
    } else if (type === "customer.subscription.updated") {
      await onSubscriptionUpdated(env.DB, sk, obj, productFilter);
    } else if (type === "customer.subscription.deleted") {
      await onSubscriptionDeleted(env.DB, obj);
    } else if (type === "invoice.paid" && sk.startsWith("sk_")) {
      await onInvoiceEvent(env, sk, obj, true, productFilter);
    } else if (type === "invoice.payment_failed" && sk.startsWith("sk_")) {
      await onInvoiceEvent(env, sk, obj, false, productFilter);
    } else if (
      (type === "charge.dispute.created" || type === "charge.dispute.funds_withdrawn" || type === "charge.dispute.closed")
      && sk.startsWith("sk_")
    ) {
      await onDisputeEvent(env.DB, sk, obj, type, productFilter);
    } else if (type === "charge.refunded" && sk.startsWith("sk_")) {
      await onChargeRefunded(env.DB, sk, obj, productFilter);
    }
  } catch (e) {
    console.error("stripe webhook handler error", String(e && typeof e === "object" && "message" in e ? (e as Error).message : e));
    return whJson({ detail: "Webhook handler error." }, 500);
  }

  return whJson({ received: true }, 200);
}
