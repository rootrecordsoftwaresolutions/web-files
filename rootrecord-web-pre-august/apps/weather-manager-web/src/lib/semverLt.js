/** True if semver string `a` is strictly less than `b` (major.minor.patch…, numeric segments). */
export function semverLt(a, b) {
  const pa = String(a || '0').split('.').map((x) => parseInt(x, 10) || 0);
  const pb = String(b || '0').split('.').map((x) => parseInt(x, 10) || 0);
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da < db) return true;
    if (da > db) return false;
  }
  return false;
}
