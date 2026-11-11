import { PurchaseTracker } from '@/components/store/purchase-tracker';
import { trackingLink } from '@/lib/commerce/order-link';
import { ensureOrderForSession } from '@/lib/commerce/recover-orders';
import { stripeConfigured } from '@/lib/stripe';
import type { CheckoutSnapshot } from '@/lib/commerce/db';
import { round2, toNumber } from '@/lib/commerce/pricing';
import { supabaseConfigured } from '@/lib/supabase/env';
import { createServiceClient } from '@/lib/supabase/server';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Thank you', robots: { index: false } };
export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ session_id?: string }> };

/**
 * Stripe sends the customer here after payment.
 *
 * The webhook normally creates the order a second or two earlier. This page
 * creates it too if it isn't there yet, so a webhook that is misconfigured or
 * unreachable can never lose a paid order. Both paths are idempotent, so
 * whichever runs second finds the order and stops.
 */
export default async function CheckoutSuccessPage({ searchParams }: Props) {
  const { session_id } = await searchParams;

  let orderNumber: number | null = null;
  let email: string | null = null;
  let trackUrl: string | null = null;
  let purchase: Parameters<typeof PurchaseTracker>[0] | null = null;

  if (supabaseConfigured && session_id?.startsWith('cs_')) {
    try {
      // Safety net: create the order now if the webhook hasn't.
      if (stripeConfigured()) {
        await ensureOrderForSession(session_id).catch((e) => console.error('[success] order recovery failed:', e));
      }
      const db = createServiceClient();
      const [{ data: order }, { data: checkout }] = await Promise.all([
        db.from('orders').select('id, order_number, email, total, tax_total').eq('stripe_checkout_session_id', session_id).maybeSingle(),
        db.from('checkouts').select('snapshot').eq('stripe_session_id', session_id).maybeSingle()
      ]);
      orderNumber = order?.order_number ?? null;
      email = order?.email ?? null;
      if (order) trackUrl = trackingLink(order);

      const snapshot = checkout?.snapshot as CheckoutSnapshot | undefined;
      if (snapshot) {
        const estimated = snapshot.subtotal - (snapshot.discount?.amount ?? 0) + snapshot.shipping;
        purchase = {
          id: orderNumber ? String(orderNumber) : session_id,
          value: round2(order ? toNumber(order.total) : estimated),
          currency: snapshot.currency,
          shipping: snapshot.shipping,
          tax: order ? toNumber(order.tax_total) : 0,
          items: snapshot.lines.map((l) => ({
            id: l.variant_id,
            name: l.title,
            variant: l.variant_title,
            price: l.price,
            quantity: l.quantity
          }))
        };
      }
    } catch {
      // Ignore — the generic message below covers it.
    }
  }

  return (
    <section className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      {purchase && <PurchaseTracker {...purchase} />}
      <p className="eyebrow text-brand-600">Order confirmed</p>
      <h1 className="heading-caps mt-3 text-3xl">Thank you for your order</h1>
      <p className="mt-4 text-muted">
        {orderNumber ? `Your order #${orderNumber} is confirmed.` : 'Your payment went through and your order is being confirmed.'}{' '}
        {email ? `A confirmation email is on its way to ${email}.` : 'A confirmation email is on its way to your inbox.'}
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {trackUrl && (
          <a href={trackUrl} className="btn-outline">
            Track your order
          </a>
        )}
        <Link href="/collections/all" className="btn-solid">
          Continue shopping
        </Link>
      </div>
    </section>
  );
}
