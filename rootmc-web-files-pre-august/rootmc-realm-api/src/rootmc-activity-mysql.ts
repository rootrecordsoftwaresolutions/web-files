/**
 * Persist Discord #time-zone selections to MySQL for Root-Activity (overrides IP estimate).
 */

import type { Connection } from "mysql2/promise";
import mysql from "mysql2/promise";

import { resolveLinkedPlayerByDiscord } from "./discord-rootmc-economy";
import type { RootStatEnv } from "./rootstat-minecraft";

type ActivityMysqlEnv = RootStatEnv & {
  ROOTMC_MYSQL?: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  };
  ROOTMC_MYSQL_TABLE_PREFIX?: string;
};

function tablePrefix(env: ActivityMysqlEnv): string {
  const raw = env.ROOTMC_MYSQL_TABLE_PREFIX;
  return raw == null || String(raw).trim() === "" ? "root_" : String(raw).trim();
}

async function openMysql(env: ActivityMysqlEnv): Promise<Connection | null> {
  const hd = env.ROOTMC_MYSQL;
  if (!hd?.host || !hd.user || !hd.database) {
    return null;
  }
  return mysql.createConnection({
    host: hd.host,
    port: hd.port || 3306,
    user: hd.user,
    password: hd.password,
    database: hd.database,
    disableEval: true,
  });
}

export async function persistDiscordTimezone(
  env: ActivityMysqlEnv,
  discordUserId: string,
  timezoneKey: string,
): Promise<void> {
  const key = String(timezoneKey || "").trim();
  if (!key) return;

  const linked = await resolveLinkedPlayerByDiscord(env.DB, discordUserId);
  if (!linked?.minecraftUuid) return;

  const conn = await openMysql(env);
  if (!conn) return;

  const table = `${tablePrefix(env)}activity_timezone`;
  try {
    await conn.execute(
      `INSERT INTO ${table} (minecraft_uuid, timezone_key, source, last_ip, updated_at)
       VALUES (?, ?, 'discord', NULL, UTC_TIMESTAMP())
       ON DUPLICATE KEY UPDATE
         timezone_key = VALUES(timezone_key),
         source = 'discord',
         updated_at = UTC_TIMESTAMP()`,
      [linked.minecraftUuid.toLowerCase(), key],
    );
  } finally {
    await conn.end();
  }
}
