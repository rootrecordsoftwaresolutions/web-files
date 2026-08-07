import fs from "node:fs";
import path from "node:path";
import bs58 from "bs58";
import { Keypair } from "@solana/web3.js";

const walletsPath = "C:\\Users\\rrdeveloper\\Desktop\\Solana Wallets\\wallets.env";
const credPath = "c:\\Users\\rrdeveloper\\MonoRepo\\credentials.env";
const outPath = "C:\\Users\\rrdeveloper\\Desktop\\Solana Wallets\\wallet-balances-report.txt";

function loadEnvFile(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#") || t.startsWith("-")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return env;
}

function derivePubFromPrivate(b58) {
  const sk = bs58.decode(b58);
  const kp =
    sk.length === 64
      ? Keypair.fromSecretKey(sk)
      : sk.length === 32
        ? Keypair.fromSeed(sk)
        : null;
  return kp ? kp.publicKey.toBase58() : null;
}

function parseWallets(text) {
  const entries = [];
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#") || t.startsWith("-")) continue;
    if (!t.includes("=")) continue;
    const eq = t.indexOf("=");
    const key = t.slice(0, eq).trim();
    const val = t.slice(eq + 1).trim();
    if (key.startsWith("SOLANA_PUBLIC_")) {
      const label = key.replace("SOLANA_PUBLIC_", "");
      entries.push({ label, pubkey: val, private: "" });
    } else if (key.startsWith("SOLANA_PRIVATE_")) {
      const label = key.replace("SOLANA_PRIVATE_", "");
      const existing = entries.find((e) => e.label === label);
      if (existing) existing.private = val;
      else entries.push({ label, pubkey: "", private: val });
    }
  }
  for (const e of entries) {
    if (!e.pubkey && e.private) e.pubkey = derivePubFromPrivate(e.private) || "";
  }
  return entries.filter((e) => e.pubkey && e.pubkey.length >= 32);
}

async function rpc(rpcUrl, method, params) {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(`${method}: ${json.error.message || JSON.stringify(json.error)}`);
  return json.result;
}

function lamportsFromBalanceResult(result) {
  if (result == null) return 0;
  if (typeof result === "number") return result;
  if (typeof result === "object" && "value" in result) return Number(result.value) || 0;
  return 0;
}

const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

async function fetchSplTokens(rpcUrl, owner) {
  const tokens = [];
  for (const programId of [TOKEN_PROGRAM, TOKEN_2022_PROGRAM]) {
    const result = await rpc(rpcUrl, "getTokenAccountsByOwner", [
      owner,
      { programId },
      { encoding: "jsonParsed" },
    ]);
    for (const row of result?.value || []) {
      const info = row?.account?.data?.parsed?.info;
      if (!info) continue;
      const amt = info.tokenAmount;
      const ui = Number(amt?.uiAmount ?? 0);
      if (!ui) continue;
      tokens.push({
        mint: info.mint,
        ui,
        symbol: "",
        decimals: amt?.decimals ?? 0,
      });
    }
  }
  return tokens;
}

async function fetchOwnerAssets(rpcUrl, owner) {
  const items = [];
  let page = 1;
  for (;;) {
    const result = await rpc(rpcUrl, "getAssetsByOwner", {
      ownerAddress: owner,
      page,
      limit: 1000,
    });
    const batch = result?.items || [];
    items.push(...batch);
    const total = result?.total ?? items.length;
    if (items.length >= total || batch.length === 0) break;
    page += 1;
    if (page > 20) break;
  }
  return items;
}

function formatTokenBalance(item) {
  const iface = item?.interface || "";
  const id = item?.id || "";
  const symbol =
    item?.content?.metadata?.symbol ||
    item?.token_info?.symbol ||
    item?.content?.metadata?.name ||
    "";
  const decimals = item?.token_info?.decimals ?? 0;
  const raw = item?.token_info?.balance ?? item?.token_info?.amount ?? 0;
  const n = Number(raw);
  const ui = decimals > 0 ? n / 10 ** decimals : n;
  return { iface, mint: id, symbol, ui };
}

async function main() {
  const cred = loadEnvFile(credPath);
  const rpcUrl =
    cred.SOLANA_RPC_URL ||
    cred.HELIUS_RPC_URL ||
    (cred.HELIUS_API_KEY
      ? `https://mainnet.helius-rpc.com/?api-key=${encodeURIComponent(cred.HELIUS_API_KEY)}`
      : "");
  if (!rpcUrl) {
    console.error("No SOLANA_RPC_URL / HELIUS_* in credentials.env");
    process.exit(1);
  }

  const entries = parseWallets(fs.readFileSync(walletsPath, "utf8"));
  const byPub = new Map();
  for (const e of entries) {
    if (!byPub.has(e.pubkey)) byPub.set(e.pubkey, []);
    byPub.get(e.pubkey).push(e.label);
  }

  const lines = [];
  lines.push(`Wallet balance report — ${new Date().toISOString()}`);
  lines.push(`Unique addresses: ${byPub.size}`);
  lines.push("");

  let totalSol = 0;
  const tokenTotals = new Map();

  for (const [pubkey, labels] of [...byPub.entries()].sort((a, b) =>
    a[1][0].localeCompare(b[1][0])
  )) {
    lines.push("=".repeat(72));
    lines.push(`Labels: ${labels.join(", ")}`);
    lines.push(`Address: ${pubkey}`);

    let solLamports = 0;
    try {
      solLamports = lamportsFromBalanceResult(await rpc(rpcUrl, "getBalance", [pubkey]));
    } catch (e) {
      lines.push(`SOL: ERROR ${e.message}`);
    }
    const sol = solLamports / 1e9;
    totalSol += sol;
    lines.push(`SOL: ${sol.toFixed(9)} (${solLamports} lamports)`);

    try {
      const [spl, assets] = await Promise.all([
        fetchSplTokens(rpcUrl, pubkey),
        fetchOwnerAssets(rpcUrl, pubkey),
      ]);
      const dasFungible = assets
        .map(formatTokenBalance)
        .filter((t) => t.iface === "FungibleToken" || t.iface === "FungibleAsset")
        .filter((t) => t.ui > 0);
      const byMint = new Map();
      for (const t of [...spl, ...dasFungible]) {
        const prev = byMint.get(t.mint) || { mint: t.mint, ui: 0, symbol: t.symbol || "" };
        prev.ui = Math.max(prev.ui, t.ui);
        if (t.symbol) prev.symbol = t.symbol;
        byMint.set(t.mint, prev);
      }
      const fungible = [...byMint.values()].filter((t) => t.ui > 0);

      if (!fungible.length) {
        lines.push("SPL tokens: (none with balance)");
      } else {
        lines.push("SPL tokens:");
        for (const t of fungible.sort((a, b) => a.mint.localeCompare(b.mint))) {
          const sym = t.symbol || t.mint.slice(0, 8);
          lines.push(`  ${sym.padEnd(14)} ${t.ui}  mint=${t.mint}`);
          const key = t.mint;
          const prev = tokenTotals.get(key) || { symbol: sym, mint: t.mint, ui: 0 };
          prev.ui += t.ui;
          tokenTotals.set(key, prev);
        }
      }
      const nftCount = assets.filter(
        (a) =>
          ["V1_NFT", "ProgrammableNFT", "MplCoreAsset"].includes(a?.interface) &&
          Number(a?.ownership?.amount ?? 1) > 0
      ).length;
      if (nftCount) lines.push(`NFTs / non-fungible: ${nftCount}`);
    } catch (e) {
      lines.push(`Tokens: ERROR ${e.message}`);
    }
    lines.push("");
  }

  lines.push("=".repeat(72));
  lines.push("PORTFOLIO SUMMARY");
  lines.push(`Total SOL: ${totalSol.toFixed(9)}`);
  if (tokenTotals.size) {
    lines.push("Aggregated SPL:");
    for (const t of [...tokenTotals.values()].sort((a, b) => a.symbol.localeCompare(b.symbol))) {
      lines.push(`  ${t.symbol.padEnd(14)} ${t.ui}  mint=${t.mint}`);
    }
  }

  fs.writeFileSync(outPath, lines.join("\n"), "utf8");
  console.log(`Wrote ${outPath}\n`);
  console.log(lines.join("\n"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
