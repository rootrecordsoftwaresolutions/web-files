import { accessFromPayload, api, session } from './api';

export const UPSELL_EVENT = 'rr.upsell.show';
export const FORECAST_DAYS_FREE = 3;
export const FORECAST_DAYS_PRO = 5;
export const BILLING_URL = 'https://rootrecord.info/billing';

export function hasProAccess() {
  return session.isPro() || session.isLifeMember();
}

export function getMemberTier() {
  if (session.isLifeMember()) return 'lifetime';
  if (session.isPro()) return 'pro';
  return 'free';
}

export function memberStatusLabel() {
  const tier = getMemberTier();
  if (tier === 'lifetime') return 'Lifetime member';
  if (tier === 'pro') return 'Pro member';
  return 'Free';
}

export function memberStatusHint() {
  const tier = getMemberTier();
  if (tier === 'lifetime' || tier === 'pro') return 'Member features enabled · NOAA push alerts on Android';
  return 'Core forecast access · some resource-heavy features are members-only';
}

export function forecastDayLimit() {
  return hasProAccess() ? FORECAST_DAYS_PRO : FORECAST_DAYS_FREE;
}

export function showUpsellModal() {
  try {
    window.dispatchEvent(new Event(UPSELL_EVENT));
  } catch {
    /* ignore */
  }
}

/** Refresh Pro / Lifetime flags from the server (e.g. after billing changes). */
export async function refreshSessionAccess() {
  if (!session.isAuthed()) return false;
  try {
    const { data } = await api.me();
    const access = accessFromPayload(data);
    session.setAccess(access.pro, access.life);
    return true;
  } catch {
    /* offline — keep cached tier */
    return false;
  }
}
