/**
 * Root Manager — operator-only custodial wallet utility: remote D1 (via wrangler), AES decrypt
 * (INTERNAL_WALLET_ENC_KEY_B64), Solana RPC. Loads repo credentials.env (+ Web/credentials.env merge).
 *
 * Not for distribution — build a private .exe with build-exe.ps1.
 */
import "./silence-bigint-warn.mjs";
import { readFileSync, existsSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, execSync } from "node:child_process";

import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";

/** `node script.js …` → argv[1] is the script; pkg `.exe …` → argv[1] is the first user arg. */
function userCliArgv() {
  const a = process.argv;
  if (a.length >= 2 && /\.(mjs|cjs|js)$/i.test(basename(a[1] || ""))) {
    return a.slice(2);
  }
  return a.slice(1);
}

function winPauseBeforeExit() {
  if (process.platform !== "win32") return;
  try {
    execSync("pause", { stdio: "inherit" });
  } catch {
    /* Ctrl+C or non-interactive */
  }
}

const RPC_FALLBACKS = [
  "https://solana-rpc.publicnode.com",
  "https://rpc.ankr.com/solana",
  "https://api.mainnet-beta.solana.com",
];

function searchRoots() {
  const roots = new Set();
  roots.add(process.cwd());
  try {
    roots.add(dirname(fileURLToPath(import.meta.url)));
  } catch {
    /* cjs bundle */
  }
  if (process.pkg) {
    roots.add(dirname(process.execPath));
  }
  return [...roots];
}

function walkUpForFile(startDir, filename) {
  let probe = resolve(startDir);
  for (let i = 0; i < 22; i++) {
    const candidate = join(probe, filename);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(probe);
    if (!parent || parent === probe) break;
    probe = parent;
  }
  return null;
}

function findCredentialsPath() {
  if (process.env.CREDENTIALS_ENV && existsSync(process.env.CREDENTIALS_ENV)) {
    return process.env.CREDENTIALS_ENV;
  }
  for (const r of searchRoots()) {
    const hit = walkUpForFile(r, "credentials.env");
    if (hit) return hit;
  }
  return null;
}

function findRepoRootWithShard(startDir) {
  let probe = resolve(startDir);
  for (let i = 0; i < 22; i++) {
    const toml = join(probe, "Web", "cloudflare", "rootrecord-api-account", "wrangler.toml");
    if (existsSync(toml)) return probe;
    const parent = dirname(probe);
    if (!parent || parent === probe) break;
    probe = parent;
  }
  return null;
}

function loadEnvFile(path) {
  const text = readFileSync(path, "utf8");
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const k = line.slice(0, eq).trim();
    const v = line.slice(eq + 1).trim();
    if (!(k in process.env) || !String(process.env[k]).trim()) process.env[k] = v;
  }
}

function mergeWebCredentials(repoRoot) {
  const web = join(repoRoot, "Web", "credentials.env");
  if (existsSync(web)) loadEnvFile(web);
}

function ensureCfAuth() {
  const hasToken = process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_API_TOKEN.length >= 10;
  const hasGlobal =
    process.env.CLOUDFLARE_API_KEY &&
    process.env.CLOUDFLARE_EMAIL &&
    process.env.CLOUDFLARE_API_KEY.length >= 10;
  if (!hasToken && !hasGlobal) {
    throw new Error("Set CLOUDFLARE_API_TOKEN or CLOUDFLARE_EMAIL + CLOUDFLARE_API_KEY (or CLOUDFLARE_GLOBAL_API_KEY) in credentials.env.");
  }
  if (process.env.CLOUDFLARE_GLOBAL_API_KEY && !process.env.CLOUDFLARE_API_KEY) {
    process.env.CLOUDFLARE_API_KEY = process.env.CLOUDFLARE_GLOBAL_API_KEY;
  }
}

function resolveWorkerRoot(repoRoot) {
  if (process.env.ROOTRECORD_ACCOUNT_DIR) {
    const d = resolve(process.env.ROOTRECORD_ACCOUNT_DIR);
    if (existsSync(join(d, "wrangler.toml"))) return d;
    throw new Error(`ROOTRECORD_ACCOUNT_DIR invalid (no wrangler.toml): ${d}`);
  }
  const rel = join(repoRoot, "Web", "cloudflare", "rootrecord-api-account");
  if (existsSync(join(rel, "wrangler.toml"))) return rel;
  throw new Error("Could not find Web/cloudflare/rootrecord-api-account/wrangler.toml (set ROOTRECORD_ACCOUNT_DIR).");
}

function wranglerJs(workerRoot) {
  const p = join(workerRoot, "node_modules", "wrangler", "bin", "wrangler.js");
  if (!existsSync(p)) {
    throw new Error(`wrangler not installed at ${p} — run: cd rootrecord-api-account && npm ci`);
  }
  return p;
}

function d1ExecuteJson(workerRoot, sql) {
  const out = execFileSync(process.execPath, [wranglerJs(workerRoot), "d1", "execute", "root-record", "--remote", "--json", "--command", sql], {
    cwd: workerRoot,
    encoding: "utf8",
    env: process.env,
    shell: false,
  });
  const jsonStart = out.indexOf("[");
  const jsonEnd = out.lastIndexOf("]");
  if (jsonStart < 0 || jsonEnd <= jsonStart) {
    throw new Error(`wrangler d1: no JSON in stdout: ${out.slice(0, 400)}`);
  }
  return JSON.parse(out.slice(jsonStart, jsonEnd + 1));
}

function firstResultRow(parsed) {
  const row = parsed?.[0]?.results?.[0];
  return row && typeof row === "object" ? row : null;
}

function allResultRows(parsed) {
  return Array.isArray(parsed?.[0]?.results) ? parsed[0].results : [];
}

function assertPubkeyB58(s) {
  const t = String(s || "").trim();
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(t)) {
    throw new Error("Expected Solana pubkey base58 (32–44 chars).");
  }
  return t;
}

function assertAccountId(s) {
  const t = String(s || "").trim();
  if (!/^[a-zA-Z0-9_.-]{4,128}$/.test(t)) {
    throw new Error("Account id looks invalid (use 4–128 chars: letters, digits, ._-).");
  }
  return t;
}

function classifyLookupToken(token) {
  const t = String(token || "").trim();
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(t)) return { kind: "pubkey", value: t };
  return { kind: "account_id", value: assertAccountId(t) };
}

function escapeSqlString(s) {
  return String(s).replace(/'/g, "''");
}

function hexToUint8(hex) {
  const clean = String(hex).replace(/^0x/i, "").trim();
  if (clean.length % 2 !== 0) throw new Error("invalid hex length");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

async function importAesKeyFromEnv() {
  const b64 = String(process.env.INTERNAL_WALLET_ENC_KEY_B64 || "").trim();
  if (!b64) throw new Error("INTERNAL_WALLET_ENC_KEY_B64 missing in credentials.env");
  const raw = Buffer.from(b64, "base64");
  if (raw.length !== 32) throw new Error("INTERNAL_WALLET_ENC_KEY_B64 must decode to 32 bytes");
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["decrypt"]);
}

async function decryptToKeypair(aesKey, encHex, ivHex) {
  const ct = hexToUint8(encHex);
  const iv = hexToUint8(ivHex);
  const ptBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, aesKey, ct);
  const sk = new Uint8Array(ptBuf);
  if (sk.length === 64) return Keypair.fromSecretKey(sk);
  if (sk.length === 32) return Keypair.fromSeed(sk);
  throw new Error(`unexpected decrypted secret length ${sk.length}`);
}

function fetchEncRowByPubkey(workerRoot, pubkeyB58) {
  const safe = assertPubkeyB58(pubkeyB58);
  const sql = `SELECT account_id, hex(privkey_pkcs8_enc) AS enc_hex, hex(privkey_iv) AS iv_hex FROM internal_solana_wallets WHERE pubkey = '${safe}'`;
  const parsed = d1ExecuteJson(workerRoot, sql);
  const row = firstResultRow(parsed);
  if (!row?.enc_hex || !row?.iv_hex) {
    throw new Error(`No internal_solana_wallets row for pubkey ${safe}`);
  }
  return {
    account_id: String(row.account_id || "").trim(),
    enc_hex: String(row.enc_hex).trim(),
    iv_hex: String(row.iv_hex).trim(),
  };
}

function fetchEncRowByAccountId(workerRoot, accountId) {
  const id = assertAccountId(accountId);
  const sql = `SELECT account_id, pubkey, hex(privkey_pkcs8_enc) AS enc_hex, hex(privkey_iv) AS iv_hex FROM internal_solana_wallets WHERE account_id = '${escapeSqlString(id)}'`;
  const parsed = d1ExecuteJson(workerRoot, sql);
  const row = firstResultRow(parsed);
  if (!row?.enc_hex || !row?.iv_hex) {
    throw new Error(`No wallet row for account_id ${id}`);
  }
  return {
    account_id: String(row.account_id || "").trim(),
    pubkey: String(row.pubkey || "").trim(),
    enc_hex: String(row.enc_hex).trim(),
    iv_hex: String(row.iv_hex).trim(),
  };
}

async function loadKeypairForLookup(workerRoot, token) {
  const { kind, value } = classifyLookupToken(token);
  const aesKey = await importAesKeyFromEnv();
  if (kind === "pubkey") {
    const r = fetchEncRowByPubkey(workerRoot, value);
    const kp = await decryptToKeypair(aesKey, r.enc_hex, r.iv_hex);
    if (kp.publicKey.toBase58() !== value) throw new Error("Decrypted key does not match D1 pubkey");
    return { kp, account_id: r.account_id, pubkey: value };
  }
  const r = fetchEncRowByAccountId(workerRoot, value);
  const kp = await decryptToKeypair(aesKey, r.enc_hex, r.iv_hex);
  if (kp.publicKey.toBase58() !== r.pubkey) throw new Error("Decrypted key does not match D1 pubkey");
  return { kp, account_id: r.account_id, pubkey: r.pubkey };
}

function rpcUrlCandidates() {
  const primary = String(process.env.SOLANA_RPC_URL || "").trim();
  const out = [];
  for (const u of [primary, ...RPC_FALLBACKS]) {
    if (u && !out.includes(u)) out.push(u);
  }
  return out;
}

async function pickConnection() {
  for (const url of rpcUrlCandidates()) {
    try {
      const c = new Connection(url, "confirmed");
      await c.getLatestBlockhash("confirmed");
      return { connection: c, rpcUrl: url };
    } catch {
      /* try next */
    }
  }
  throw new Error("No working Solana RPC (set SOLANA_RPC_URL in credentials.env)");
}

async function sumMintRawForOwner(connection, mint, owner) {
  let totalRaw = 0n;
  for (const programId of [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]) {
    const { value } = await connection.getParsedTokenAccountsByOwner(owner, { programId });
    for (const row of value || []) {
      const raw = row.account.data;
      if (typeof raw !== "object" || raw === null || !("parsed" in raw)) continue;
      const parsed = raw.parsed;
      if (!parsed || parsed.type !== "account" || !parsed.info) continue;
      const info = parsed.info;
      const mintStr = String(info.mint || "").trim();
      const ownerStr = String(info.owner || "").trim();
      if (!mintStr || !ownerStr) continue;
      let accMint;
      let accOwner;
      try {
        accMint = new PublicKey(mintStr);
        accOwner = new PublicKey(ownerStr);
      } catch {
        continue;
      }
      if (!accMint.equals(mint) || !accOwner.equals(owner)) continue;
      totalRaw += BigInt(String(info.tokenAmount?.amount ?? "0"));
    }
  }
  return totalRaw;
}

async function tokenBalanceViaAta(connection, mint, custodialPk, decimals) {
  for (const programId of [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]) {
    try {
      const ata = getAssociatedTokenAddressSync(mint, custodialPk, false, programId, ASSOCIATED_TOKEN_PROGRAM_ID);
      const bal = await connection.getTokenAccountBalance(ata);
      if (!bal?.value) continue;
      const raw = BigInt(String(bal.value.amount || "0"));
      const ui = bal.value.uiAmount;
      return { raw, ui, programId: programId.toBase58() };
    } catch {
      /* next program */
    }
  }
  return { raw: 0n, ui: null, programId: null };
}

function printHelp() {
  console.log(`Root Manager (operator)

Environment (credentials.env at monorepo root, or CREDENTIALS_ENV):
  CLOUDFLARE_API_TOKEN or CLOUDFLARE_EMAIL + CLOUDFLARE_GLOBAL_API_KEY
  INTERNAL_WALLET_ENC_KEY_B64
  SOLANA_RPC_URL (optional)
  RR_PUSH_ADMIN_SECRET (for provision)
  ROOTRECORD_ACCOUNT_API (optional; default account Worker URL)
  RRTT_MINT_BASE58 + RRTT_DECIMALS (optional; for balance SPL line)

Optional overrides:
  ROOTRECORD_ACCOUNT_DIR  Path to rootrecord-api-account (if not under repo Web/cloudflare/…)
  CREDENTIALS_ENV         Full path to credentials.env

Commands:
  stats                          Row counts from D1
  list [--limit N] [--q S]     List custodial wallets (newest first; q = substring match)
  lookup <accountId|pubkey>    D1 row metadata (no secret material)
  verify <accountId|pubkey>    Decrypt and confirm pubkey match (does not print keys)
  balance <accountId|pubkey>   SOL + optional RRTT totals on-chain
  provision [--once] [--batch N]   POST internal provision endpoint until idle (default batch 300)
`);
}

async function cmdStats(workerRoot) {
  const total = firstResultRow(d1ExecuteJson(workerRoot, "SELECT COUNT(*) AS c FROM internal_solana_wallets"));
  const c = Math.max(0, Math.floor(Number(total?.c) || 0));
  console.log(JSON.stringify({ internal_solana_wallets: c }, null, 2));
}

async function cmdList(workerRoot, limit, q) {
  const lim = Math.min(200, Math.max(1, Math.floor(Number(limit) || 30)));
  let sql;
  if (q && String(q).trim()) {
    const s = escapeSqlString(String(q).trim().slice(0, 120));
    sql = `SELECT iw.account_id, iw.pubkey, iw.created_at, la.email
      FROM internal_solana_wallets iw
      LEFT JOIN license_accounts la ON la.id = iw.account_id
      WHERE LOWER(iw.account_id) LIKE LOWER('%${s}%')
         OR LOWER(iw.pubkey) LIKE LOWER('%${s}%')
         OR LOWER(IFNULL(la.email,'')) LIKE LOWER('%${s}%')
      ORDER BY iw.created_at DESC LIMIT ${lim}`;
  } else {
    sql = `SELECT iw.account_id, iw.pubkey, iw.created_at, la.email
      FROM internal_solana_wallets iw
      LEFT JOIN license_accounts la ON la.id = iw.account_id
      ORDER BY iw.created_at DESC LIMIT ${lim}`;
  }
  const rows = allResultRows(d1ExecuteJson(workerRoot, sql));
  console.log(JSON.stringify({ count: rows.length, rows }, null, 2));
}

async function cmdLookup(workerRoot, token) {
  const { kind, value } = classifyLookupToken(token);
  if (kind === "pubkey") {
    const sql = `SELECT account_id, pubkey, created_at,
      length(privkey_pkcs8_enc) AS enc_bytes,
      length(privkey_iv) AS iv_bytes
      FROM internal_solana_wallets WHERE pubkey = '${assertPubkeyB58(value)}'`;
    console.log(JSON.stringify(firstResultRow(d1ExecuteJson(workerRoot, sql)), null, 2));
    return;
  }
  const sql = `SELECT account_id, pubkey, created_at,
    length(privkey_pkcs8_enc) AS enc_bytes,
    length(privkey_iv) AS iv_bytes
    FROM internal_solana_wallets WHERE account_id = '${escapeSqlString(value)}'`;
  console.log(JSON.stringify(firstResultRow(d1ExecuteJson(workerRoot, sql)), null, 2));
}

async function cmdVerify(workerRoot, token) {
  const { kp, account_id, pubkey } = await loadKeypairForLookup(workerRoot, token);
  console.log(JSON.stringify({ ok: true, account_id, pubkey, derived_pubkey: kp.publicKey.toBase58() }, null, 2));
}

async function cmdBalance(workerRoot, token) {
  const { kp, account_id, pubkey } = await loadKeypairForLookup(workerRoot, token);
  const { connection, rpcUrl } = await pickConnection();
  const lamports = await connection.getBalance(kp.publicKey, "confirmed");
  const out = {
    account_id,
    pubkey,
    rpcUrl,
    sol_lamports: lamports,
    sol: lamports / 1e9,
  };
  const mintB58 = String(process.env.RRTT_MINT_BASE58 || "").trim();
  const decStr = String(process.env.RRTT_DECIMALS || "9").trim();
  const decimals = Math.min(18, Math.max(0, Math.floor(Number(decStr) || 9)));
  if (mintB58) {
    try {
      const mint = new PublicKey(mintB58);
      const rawSum = await sumMintRawForOwner(connection, mint, kp.publicKey);
      const ata = await tokenBalanceViaAta(connection, mint, kp.publicKey, decimals);
      out.rrtt_mint = mintB58;
      out.rrtt_total_raw_from_parsed_accounts = String(rawSum);
      out.rrtt_ata_amount_raw = String(ata.raw);
      out.rrtt_ata_ui = ata.ui;
    } catch (e) {
      out.rrtt_error = e instanceof Error ? e.message : String(e);
    }
  }
  console.log(JSON.stringify(out, null, 2));
}

async function provisionOnce(apiBase, admin, batch) {
  const uri = `${apiBase}/api/internal/provision-custodial-wallets-missing`;
  const r = await fetch(uri, {
    method: "POST",
    headers: {
      "X-RR-Push-Admin-Key": admin,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ limit: batch }),
  });
  const text = await r.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 500) };
  }
  if (!r.ok) {
    throw new Error(`HTTP ${r.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

async function cmdProvision(opts) {
  const admin = String(process.env.RR_PUSH_ADMIN_SECRET || "").trim();
  if (admin.length < 8) throw new Error("RR_PUSH_ADMIN_SECRET missing or too short");
  let api = String(
    process.env.ROOTRECORD_ACCOUNT_API || process.env.ROOTRECORD_PRIMARY_API || "https://rootrecord-api-account.rootrecord.workers.dev",
  ).trim();
  api = api.replace(/\/$/, "");
  const batch = Math.min(500, Math.max(1, Math.floor(Number(opts.batch) || 300)));
  let round = 0;
  let total = 0;
  for (;;) {
    round++;
    const res = await provisionOnce(api, admin, batch);
    const p = Math.floor(Number(res.provisioned) || 0);
    const examined = Math.floor(Number(res.examined) || 0);
    const rem = Math.floor(Number(res.remaining_without_wallet) || 0);
    total += p;
    console.log(JSON.stringify({ round, examined, provisioned: p, remaining_without_wallet: rem, ok: res.ok }, null, 2));
    if (opts.once) break;
    if (!res.more_batches_suggested) break;
    if (examined === 0 && p === 0) break;
  }
  console.log(JSON.stringify({ done: true, total_provisioned: total }, null, 2));
}

function parseArgs(argv) {
  const out = { _: [], flags: new Set() };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") out.flags.add("help");
    else if (a === "--once") out.flags.add("once");
    else if (a === "--limit") out.limit = argv[++i];
    else if (a === "--q") out.q = argv[++i];
    else if (a === "--batch") out.batch = argv[++i];
    else if (a.startsWith("--")) throw new Error(`Unknown flag ${a}`);
    else out._.push(a);
  }
  return out;
}

async function main() {
  const raw = userCliArgv();
  const argv = parseArgs(raw);

  if (argv.flags.has("help")) {
    printHelp();
    process.exit(0);
  }

  if (argv._.length === 0) {
    printHelp();
    console.error('\nNo command. From Command Prompt run e.g.: "Root Manager.exe" stats');
    winPauseBeforeExit();
    process.exit(1);
  }

  const credPath = findCredentialsPath();
  if (!credPath) {
    console.error("credentials.env not found. Set CREDENTIALS_ENV or run from repo tree.");
    winPauseBeforeExit();
    process.exit(1);
  }
  loadEnvFile(credPath);
  let repoRoot = findRepoRootWithShard(dirname(credPath));
  if (!repoRoot) {
    for (const r of searchRoots()) {
      repoRoot = findRepoRootWithShard(r);
      if (repoRoot) break;
    }
  }
  if (!repoRoot) {
    console.error("Could not locate monorepo root containing Web/cloudflare/rootrecord-api-account.");
    winPauseBeforeExit();
    process.exit(1);
  }
  mergeWebCredentials(repoRoot);

  ensureCfAuth();
  const workerRoot = resolveWorkerRoot(repoRoot);

  const cmd = argv._[0];
  const rest = argv._.slice(1);

  try {
    if (cmd === "stats") await cmdStats(workerRoot);
    else if (cmd === "list") await cmdList(workerRoot, argv.limit, argv.q);
    else if (cmd === "lookup") {
      if (!rest[0]) throw new Error("lookup <accountId|pubkey>");
      await cmdLookup(workerRoot, rest[0]);
    } else if (cmd === "verify") {
      if (!rest[0]) throw new Error("verify <accountId|pubkey>");
      await cmdVerify(workerRoot, rest[0]);
    } else if (cmd === "balance") {
      if (!rest[0]) throw new Error("balance <accountId|pubkey>");
      await cmdBalance(workerRoot, rest[0]);
    } else if (cmd === "provision") {
      await cmdProvision({ once: argv.flags.has("once"), batch: argv.batch });
    } else {
      console.error(`Unknown command: ${cmd}`);
      printHelp();
      process.exit(1);
    }
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
}

main();
