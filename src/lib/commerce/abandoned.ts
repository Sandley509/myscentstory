import 'server-only';

import { createServiceClient } from '@/lib/supabase/server';
import type Stripe from 'stripe';

/**
 * A Stripe checkout expired without payment (Stripe sends
 * `checkout.session.expired` about an hour after the shopper left). Keep the
 * email they typed at Stripe so the cart can get a reminder.
 */
export async function recordExpiredCheckout(session: Stripe.Checkout.Session) {
  const email = (session.customer_details?.email ?? session.customer_email ?? '').trim().toLowerCase() || null;
  const { error } = await createServiceClient()
    .from('checkouts')
    .update({ expired_at: new Date().toISOString(), ...(email ? { email } : {}) })
    .eq('stripe_session_id', session.id);
  // Before migration 0005 the columns don't exist; nothing to record then.
  if (error && !/expired_at|column/.test(error.message)) throw new Error(error.message);
}
