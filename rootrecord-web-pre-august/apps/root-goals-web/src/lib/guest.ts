const KEY = "rg_guest_id";

export function getGuestId(): string {
  try {
    const existing = localStorage.getItem(KEY);
    if (existing && existing.length >= 8) return existing;
    const id = `g_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
    localStorage.setItem(KEY, id);
    return id;
  } catch {
    return `g_${Date.now()}`;
  }
}
