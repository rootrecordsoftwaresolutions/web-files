export const ROOTS_ATOMIC_PER_WHOLE = 100_000_000;
export const ROOTS_SMALLEST_UNIT = 1 / ROOTS_ATOMIC_PER_WHOLE;

export function rootsAtomicToWhole(n: number): number {
  const v = Math.max(0, Math.floor(Number(n) || 0));
  return v / ROOTS_ATOMIC_PER_WHOLE;
}

function trimFixed8(n: number): string {
  return n.toFixed(8).replace(/\.?0+$/, "");
}

export function formatRu(n: number): string {
  const whole = rootsAtomicToWhole(n);
  if (whole >= 1_000_000_000) return `${(whole / 1_000_000_000).toFixed(2)}B ROOTS`;
  if (whole >= 1_000_000) return `${(whole / 1_000_000).toFixed(2)}M ROOTS`;
  if (whole >= 10_000) return `${(whole / 1_000).toFixed(1)}K ROOTS`;
  if (whole >= 1_000) return `${(whole / 1_000).toFixed(2)}K ROOTS`;
  return `${trimFixed8(whole)} ROOTS`;
}

export function formatRuRate(n: number): string {
  const wholePerSec = Math.max(0, Number(n) || 0) / ROOTS_ATOMIC_PER_WHOLE;
  if (wholePerSec >= 1_000) return `${(wholePerSec / 1_000).toFixed(2)}K ROOTS/s`;
  if (wholePerSec >= 1) return `${wholePerSec.toLocaleString(undefined, { maximumFractionDigits: 4 })} ROOTS/s`;
  if (wholePerSec > 0) return `${trimFixed8(Math.max(ROOTS_SMALLEST_UNIT, wholePerSec))} ROOTS/s`;
  return "0 ROOTS/s";
}

export function formatGrowTime(sec: number): string {
  if (sec < 10) return `${sec.toFixed(2)}s`;
  if (sec < 120) return `${sec.toFixed(1)}s`;
  if (sec < 3600) {
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  if (sec < 86_400) {
    const h = Math.floor(sec / 3600);
    const m = Math.round((sec % 3600) / 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  const d = Math.floor(sec / 86_400);
  const h = Math.round((sec % 86_400) / 3600);
  return h > 0 ? `${d}d ${h}h` : `${d}d`;
}
