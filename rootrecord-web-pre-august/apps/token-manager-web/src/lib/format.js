/* eslint-env es2020 */
/** Utility formatters for SOL / SPL amounts and addresses. */

export function shortAddr(addr, head = 4, tail = 4) {
  if (!addr) return "";
  const s = String(addr);
  if (s.length <= head + tail + 1) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

export function lamportsToSol(lamports) {
  const n = Number(lamports || 0);
  return n / 1_000_000_000;
}

export function solToLamports(sol) {
  const n = Number(sol || 0);
  return Math.round(n * 1_000_000_000);
}

export function formatSol(lamports, digits = 4) {
  const n = lamportsToSol(lamports);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

export function formatUsd(n, digits = 2) {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return "—";
  return v.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatTokenAmount(uiAmount, digits = 4) {
  const v = Number(uiAmount ?? 0);
  if (!Number.isFinite(v)) return "0";
  if (v === 0) return "0";
  if (v < 0.0001) return v.toExponential(2);
  return v.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

export function networkLabel(net) {
  if (net === "mainnet-beta") return "MAINNET";
  if (net === "devnet") return "DEVNET";
  if (net === "testnet") return "TESTNET";
  return (net || "").toUpperCase();
}

export function timeAgo(iso) {
  if (!iso) return "";
  const t = typeof iso === "number" ? iso * 1000 : Date.parse(iso);
  if (!t) return "";
  const secs = Math.max(1, Math.round((Date.now() - t) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

/**
 * Parse a decimal string like "1.234" with N decimals into a BigInt of base units.
 * Returns null if the string is malformed or has more fractional digits than `decimals`.
 * Avoids floating-point precision loss for high-decimal tokens.
 */
export function parseDecimalToBaseUnits(decimalStr, decimals) {
  if (decimalStr == null) return null;
  const s = String(decimalStr).trim();
  if (!s || !/^\d*(\.\d*)?$/.test(s)) return null;
  const [intPartRaw, fracPartRaw = ""] = s.split(".");
  const intPart = intPartRaw || "0";
  const d = Math.max(0, Number(decimals) | 0);
  if (fracPartRaw.length > d) return null; // too many fractional digits for this token
  const frac = fracPartRaw.padEnd(d, "0");
  const combined = `${intPart}${frac}`.replace(/^0+(?=\d)/, "");
  if (combined === "") return 0n;
  try { return BigInt(combined); } catch { return null; }
}

/** Format a BigInt of base units back to a human string with up to `decimals` digits. */
export function formatBaseUnits(amountBigInt, decimals) {
  if (amountBigInt == null) return "0";
  const d = Math.max(0, Number(decimals) | 0);
  const neg = amountBigInt < 0n;
  const abs = neg ? -amountBigInt : amountBigInt;
  const s = abs.toString().padStart(d + 1, "0");
  const intPart = s.slice(0, s.length - d) || "0";
  let fracPart = s.slice(s.length - d).replace(/0+$/, "");
  return `${neg ? "-" : ""}${intPart}${fracPart ? "." + fracPart : ""}`;
}
