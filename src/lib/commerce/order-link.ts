import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';
import { absoluteUrl } from '@/lib/site';

/**
 * Signed links to an order's tracking page, used in emails and after a
 * lookup, so a customer's email address never appears in a URL (where it
 * would end up in browser history and analytics).
 */
function secret(): string {
  const s = process.env.ORDER_LINK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!s) throw new Error('Set ORDER_LINK_SECRET (or SUPABASE_SERVICE_ROLE_KEY) to create order links.');
  return s;
}

export function orderToken(orderId: string): string {
  return createHmac('sha256', secret()).update(`order:${orderId}`).digest('base64url').slice(0, 32);
}

export function verifyOrderToken(orderId: string, token: string | null | undefined): boolean {
  if (!token) return false;
  const expected = Buffer.from(orderToken(orderId));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export const trackingLink = (order: { id: string; order_number: number }) =>
  absoluteUrl(`/track?order=${order.order_number}&t=${orderToken(order.id)}`);

/** Signed link that puts an abandoned cart back in the shopper's browser (reminder emails). */
export function cartToken(cartId: string): string {
  return createHmac('sha256', secret()).update(`cart:${cartId}`).digest('base64url').slice(0, 32);
}

export function verifyCartToken(cartId: string, token: string | null | undefined): boolean {
  if (!token) return false;
  const expected = Buffer.from(cartToken(cartId));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export const cartRecoveryLink = (cartId: string) => absoluteUrl(`/cart/recover?c=${cartId}&t=${cartToken(cartId)}`);
