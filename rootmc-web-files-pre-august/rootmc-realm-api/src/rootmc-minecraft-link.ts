import type { D1Database } from "@cloudflare/workers-types";

import { json } from "./cors";

function nowIso(): string {
  return new Date().toISOString();
}

function str(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

export type LinkCodeRow = {
  code: string;
  minecraft_uuid: string;
  minecraft_username: string;
  expires_at: string;
  consumed_at: string | null;
};

export async function loadLinkCode(db: D1Database, code: string): Promise<LinkCodeRow | null> {
  const row = await db
    .prepare(
      `SELECT code, minecraft_uuid, minecraft_username, expires_at, consumed_at
       FROM rootstat_link_codes WHERE code = ? LIMIT 1`,
    )
    .bind(code)
    .first<Record<string, unknown>>();
  if (!row) return null;
  return {
    code: str(row.code),
    minecraft_uuid: str(row.minecraft_uuid).toLowerCase(),
    minecraft_username: str(row.minecraft_username),
    expires_at: str(row.expires_at),
    consumed_at: row.consumed_at ? str(row.consumed_at) : null,
  };
}

export function validateLinkCodeRow(row: LinkCodeRow | null): Response | LinkCodeRow {
  if (!row) return json({ detail: "Invalid code." }, 404);
  if (row.consumed_at) return json({ detail: "Code already used." }, 409);
  if (row.expires_at < nowIso()) {
    return json({ detail: "Code expired. Run /rootmc link in-game again." }, 410);
  }
  return row;
}

export async function upsertGlobalMinecraftLink(
  db: D1Database,
  uuid: string,
  username: string,
  accountId: string,
  email: string,
): Promise<void> {
  const now = nowIso();
  await db
    .prepare(
      `INSERT INTO rootstat_minecraft_links
         (minecraft_uuid, minecraft_username, account_id, email, verified_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(minecraft_uuid) DO UPDATE SET
         minecraft_username = excluded.minecraft_username,
         account_id = excluded.account_id,
         email = excluded.email,
         verified_at = excluded.verified_at,
         updated_at = excluded.updated_at`,
    )
    .bind(uuid, username, accountId, email, now, now)
    .run();

  const profile = await db
    .prepare("SELECT account_id FROM rootmc_player_profiles WHERE account_id = ? LIMIT 1")
    .bind(accountId)
    .first<{ account_id: string }>();

  if (profile) {
    await db
      .prepare(
        `UPDATE rootmc_player_profiles
         SET minecraft_uuid = ?, minecraft_username = ?, updated_at = ?
         WHERE account_id = ?`,
      )
      .bind(uuid, username, now, accountId)
      .run();
  } else {
    await db
      .prepare(
        `INSERT INTO rootmc_player_profiles
           (account_id, realm_username, minecraft_username, minecraft_uuid, skin_url, bio, public_profile, created_at, updated_at)
         VALUES (?, NULL, ?, ?, NULL, NULL, 1, ?, ?)`,
      )
      .bind(accountId, username, uuid, now, now)
      .run();
  }
}

export async function consumeLinkCode(
  db: D1Database,
  code: string,
  accountId: string,
): Promise<void> {
  await db
    .prepare("UPDATE rootstat_link_codes SET consumed_at = ?, account_id = ? WHERE code = ?")
    .bind(nowIso(), accountId, code)
    .run();
}
