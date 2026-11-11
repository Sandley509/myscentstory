import { sendOrderConfirmation } from '@/lib/commerce/notifications';
import { createOrderFromSession, markSessionPaid, syncRefund } from '@/lib/commerce/orders';
import { createServiceClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/stripe';
import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Stripe webhook → orders.
 *
 * In Stripe: Developers → Webhooks → Add endpoint
 *   URL:    https://YOUR-DOMAIN/api/stripe/webhook
 *   Events: checkout.session.completed,
 *           checkout.session.async_payment_succeeded,
 *           charge.refunded
 * Copy the signing secret into STRIPE_WEBHOOK_SECRET.
 */
/** Order confirmation email. Never fails the webhook: the order matters more than the email. */
async function confirm(sessionId: string) {
  try {
    const { data } = await createServiceClient().from('orders').select('id').eq('stripe_checkout_session_id', sessionId).maybeSingle();
    if (data) await sendOrderConfirmation(data.id);
  } catch (e) {
    console.error('[stripe] confirmation email failed:', e);
  }
}

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers.get('stripe-signature');
  if (!secret || !signature) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 400 });
  }

  const payload = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, secret);
  } catch (e) {
    console.error('[stripe] bad signature:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await createOrderFromSession(event.data.object);
        await confirm(event.data.object.id);
        break;
      case 'checkout.session.async_payment_succeeded':
        await markSessionPaid(event.data.object);
        await confirm(event.data.object.id);
        break;
      case 'charge.refunded':
        await syncRefund(event.data.object);
        break;
      default:
        break;
    }
  } catch (e) {
    console.error(`[stripe] handling ${event.type} failed:`, e);
    // 500 → Stripe retries with backoff.
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 });
  }

  revalidatePath('/admin', 'layout');
  return NextResponse.json({ received: true });
}
