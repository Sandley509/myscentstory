/** Shared browser state for the first-visit welcome offer. */
export type WelcomeState = { status: 'dismissed' | 'claimed'; code?: string; email?: string; appliedTo?: string; at: number };

const KEY = 'mss-welcome';

export function readWelcome(): WelcomeState | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as WelcomeState) : null;
  } catch {
    return null;
  }
}

export function writeWelcome(state: WelcomeState) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage blocked: the popup may show again next visit, which is harmless.
  }
}
