const STORAGE_KEY = "kilauea_web_guest_id";

function randomId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Same role as Android `KilaueaPreferences.ensureGuestId()` — stable per browser. */
export function ensureGuestId(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing && existing.length > 8) return existing;
    const next = randomId();
    localStorage.setItem(STORAGE_KEY, next);
    return next;
  } catch {
    return randomId();
  }
}
