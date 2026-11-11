/** Shared browser state for the first-visit welcome offer. */
export type WelcomeState = { status: 'dismissed' | 'claimed'; code?: string; email?: string; appliedTo?: string; at: number };

const KEY = 'mss-welcome';
/** Backup for browsers that block or wipe localStorage (some private modes, in-app browsers). */
const COOKIE = 'mss_welcome';

function readCookie(): string | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=([^;]*)`));
  return m ? decodeURIComponent(m[1]!) : null;
}

export function readWelcome(): WelcomeState | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as WelcomeState;
  } catch {
    // Fall through to the cookie.
  }
  try {
    const status = readCookie();
    return status === 'dismissed' || status === 'claimed' ? { status, at: 0 } : null;
  } catch {
    return null;
  }
}

export function writeWelcome(state: WelcomeState) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Blocked: the cookie below still remembers the choice.
  }
  try {
    // Status only (never the email); kept for a year.
    document.cookie = `${COOKIE}=${state.status}; Max-Age=31536000; Path=/; SameSite=Lax`;
  } catch {
    // Both blocked: the popup can show again next visit, which is harmless.
  }
}
