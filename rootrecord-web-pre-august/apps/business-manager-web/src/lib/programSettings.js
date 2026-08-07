/** Local program preferences (guest + offline fallback). Same shape as Worker `settings` row. */
const STORAGE_KEY = "rrbm_program_settings";

export const PROGRAM_SETTINGS_DEFAULT = {
  currency_default: "USD",
  theme: "dark",
  prompt_interval_sec: 900,
  prompt_first_delay_sec: 120,
  prompt_response_timeout_sec: 45,
  default_hourly_cents: 0,
  show_money_in_dashboard: true,
  help_bubbles_enabled: true,
  business_timezone: "system",
};

/** Payload for `PATCH /api/settings` (D1 settings row merge). */
export function toProgramSettingsPatch(state) {
  const s = coerceShape(state);
  return {
    currency_default: s.currency_default,
    theme: s.theme,
    prompt_interval_sec: s.prompt_interval_sec,
    prompt_first_delay_sec: s.prompt_first_delay_sec,
    prompt_response_timeout_sec: s.prompt_response_timeout_sec,
    default_hourly_cents: s.default_hourly_cents,
    show_money_in_dashboard: s.show_money_in_dashboard,
    help_bubbles_enabled: s.help_bubbles_enabled,
    business_timezone: s.business_timezone,
  };
}

function coerceShape(raw) {
  if (!raw || typeof raw !== "object") return { ...PROGRAM_SETTINGS_DEFAULT };
  return {
    ...PROGRAM_SETTINGS_DEFAULT,
    ...raw,
    currency_default: String(raw.currency_default || PROGRAM_SETTINGS_DEFAULT.currency_default),
    theme: raw.theme === "system" ? "system" : "dark",
    prompt_interval_sec: Number(raw.prompt_interval_sec) || PROGRAM_SETTINGS_DEFAULT.prompt_interval_sec,
    prompt_first_delay_sec: Number(raw.prompt_first_delay_sec) || PROGRAM_SETTINGS_DEFAULT.prompt_first_delay_sec,
    prompt_response_timeout_sec:
      Number(raw.prompt_response_timeout_sec) || PROGRAM_SETTINGS_DEFAULT.prompt_response_timeout_sec,
    default_hourly_cents: Number(raw.default_hourly_cents) || 0,
    show_money_in_dashboard: Boolean(raw.show_money_in_dashboard),
    help_bubbles_enabled: Boolean(raw.help_bubbles_enabled),
    business_timezone: String(raw.business_timezone || PROGRAM_SETTINGS_DEFAULT.business_timezone),
  };
}

export function loadProgramSettingsLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...PROGRAM_SETTINGS_DEFAULT };
    return coerceShape(JSON.parse(raw));
  } catch {
    return { ...PROGRAM_SETTINGS_DEFAULT };
  }
}

export function saveProgramSettingsLocal(state) {
  const next = coerceShape(state);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

/** Remove cached program prefs on this device (next load uses defaults). */
export function clearProgramSettingsLocal() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
