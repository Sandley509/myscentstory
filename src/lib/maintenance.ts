/**
 * Maintenance mode, switched in the environment:
 *
 *   MAINTENANCE_MODE=on    (on / true / 1 / yes; anything else = off)
 *
 * While it is on, shoppers get a "back soon" page (HTTP 503, which tells Google
 * the outage is temporary). The admin, the Stripe webhook and the other API
 * routes keep working, and anyone logged in to /admin can still browse the store.
 * On Vercel, change the variable and redeploy for it to take effect.
 */
export const isMaintenanceMode = () => /^(1|true|on|yes)$/i.test((process.env.MAINTENANCE_MODE ?? '').trim());

export const PREVIEW_COOKIE = 'mss_preview';

/** Cookie value proving the browser belongs to a logged-in admin (HMAC, so it can't be made up). */
export async function previewToken(): Promise<string> {
  const secret =
    process.env.ORDER_LINK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || 'mss-preview';
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign'
  ]);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode('maintenance-preview-v1'));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('');
}
