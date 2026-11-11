import 'server-only';

import { createOrderFromSession } from '@/lib/commerce/orders';
import { sendOrderConfirmation } from '@/lib/commerce/notifications';
import { getStripe } from '@/lib/stripe';
import { createServiceClient } from '@/lib/supabase/server';
import type Stripe from 'stripe';

const isPaid = (s: Stripe.Checkout.Session) => s.payment_status === 'paid' || s.payment_status === 'no_payment_required';

/**
 * Creates the order for one paid Stripe session if it isn't in the database yet.
 *
 * Normally the webhook does this. This is the safety net for when the webhook
 * is misconfigured, times out, or Stripe can't reach the site: the shopper has
 * paid, so the order must exist either way. `createOrderFromSession` already
 * returns the existing order when there is one, so running both is harmless.
 *
 * Returns the order id, or null when the session isn't paid or has no snapshot.
 */
export async function ensureOrderForSession(sessionId: string): Promise<{ id: string; created: boolean } | null> {
  if (!sessionId.startsWith('cs_')) return null;

  const db = createServiceClient();
  const { data: existing } = await db
    .from('orders')
    .select('id')
    .eq('stripe_checkout_session_id', sessionId)
    .maybeSingle();
  if (existing) return { id: existing.id, created: false };

  const session = await getStripe().checkout.sessions.retrieve(sessionId);
  if (!isPaid(session)) return null;

  const id = await createOrderFromSession(session);
  if (!id) return null;
  // Sends once: the first caller claims it with confirmation_email_sent_at.
  await sendOrderConfirmation(id).catch((e) => console.error('[recover] email failed:', e));
  return { id, created: true };
}

export type RecoverResult = { checked: number; created: number; alreadyThere: number; failed: { session: string; reason: string }[] };

/**
 * Looks through recent Stripe checkout sessions and creates any paid order the
 * site never recorded. Used by the "Check Stripe for missing orders" button.
 */
export async function recoverMissingOrders(days = 14): Promise<RecoverResult> {
  const since = Math.floor(Date.now() / 1000) - days * 86400;
  const out: RecoverResult = { checked: 0, created: 0, alreadyThere: 0, failed: [] };

  for await (const session of getStripe().checkout.sessions.list({ created: { gte: since }, limit: 100 })) {
    if (!isPaid(session)) continue;
    out.checked += 1;
    try {
      const res = await ensureOrderForSession(session.id);
      if (!res) out.failed.push({ session: session.id, reason: 'No saved checkout for this payment, so the order can’t be rebuilt.' });
      else if (res.created) out.created += 1;
      else out.alreadyThere += 1;
    } catch (e) {
      out.failed.push({ session: session.id, reason: e instanceof Error ? e.message : 'Unknown error.' });
    }
  }
  return out;
}
