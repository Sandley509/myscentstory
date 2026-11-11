/**
 * A random id that also works outside a secure context.
 *
 * `crypto.randomUUID` only exists on https and localhost, so opening the admin
 * over plain http (a LAN address like http://192.168.1.20:3000, say) would
 * otherwise throw "crypto.randomUUID is not a function" on every upload.
 * `crypto.getRandomValues` has no such restriction.
 */
export function randomId(): string {
  const c = globalThis.crypto;
  if (typeof c?.randomUUID === 'function') return c.randomUUID();
  if (typeof c?.getRandomValues === 'function') {
    const b = c.getRandomValues(new Uint8Array(16));
    b[6] = (b[6]! & 0x0f) | 0x40;
    b[8] = (b[8]! & 0x3f) | 0x80;
    const hex = [...b].map((n) => n.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  // Last resort (very old browsers): not cryptographic, but unique enough for a file name.
  const r = () => Math.random().toString(16).slice(2, 10);
  return `${r()}-${r().slice(0, 4)}-4${r().slice(0, 3)}-a${r().slice(0, 3)}-${r()}${r().slice(0, 4)}`;
}
