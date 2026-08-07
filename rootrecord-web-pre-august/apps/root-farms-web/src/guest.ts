const KEY = "rrfarms.guest_id";

/** In-memory guest play scope (never written to localStorage). */
export const GUEST_SCOPE = "__guest__";

/** Starting Root Units for a guest session (local only). */
export const GUEST_STARTING_BALANCE = 8_000;

export function ensureGuestId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (id && id.length >= 8) return id;
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
    return id;
  } catch {
    return "guest-anon";
  }
}
