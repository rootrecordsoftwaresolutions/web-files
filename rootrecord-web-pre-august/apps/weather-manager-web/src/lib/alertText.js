/**
 * AccuWeather (and older API snapshots) may expose `description` / `headline` as objects
 * (e.g. `{ English, Localized }`) instead of strings. Coerce to display text.
 */
export function coerceAlertNarrative(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'object' && !Array.isArray(value)) {
    const en = typeof value.English === 'string' ? value.English.trim() : '';
    const loc = typeof value.Localized === 'string' ? value.Localized.trim() : '';
    if (en) return en;
    if (loc) return loc;
    const cat = typeof value.Category === 'string' ? value.Category.trim() : '';
    const typ = typeof value.Type === 'string' ? value.Type.trim() : '';
    if (cat || typ) return [cat, typ].filter(Boolean).join(' · ');
  }
  return '';
}

export function alertDescriptionForDisplay(alert) {
  const a = alert || {};
  const d = coerceAlertNarrative(a.description);
  if (d) return d;
  const h = coerceAlertNarrative(a.headline);
  return typeof h === 'string' ? h : '';
}
