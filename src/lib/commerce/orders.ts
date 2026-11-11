import 'server-only';

import { createServiceClient } from '@/lib/supabase/server';
import type Stripe from 'stripe';
import type { Address, CheckoutSnapshot } from './db';

const fromCents = (n: number | null | undefined) => Math.round(n ?? 0) / 100;

function toAddress(a: Stripe.Address | null | undefined, name?: string | null, phone?: string | null): Address | null {
  if (!a) return null;
  return {
    name: name ?? null,
    line1: a.line1,
    line2: a.line2,
    city: a.city,
    state: a.state,
    postal_code: a.postal_code,
    country: a.country,
    phone: phone ?? null
  };
}

/**
 * Turns a paid Stripe Checkout Session into an order. Idempotent: Stripe may
 * deliver the same event more than once, and the unique
 * `stripe_checkout_session_id` makes the second insert a no-op.
 */
export async function createOrderFromSession(session: Stripe.Checkout.Session): Promise<string | null> {
  const db = createServiceClient();

  const { data: existing } = await db
    .from('orders')
    .select('id')
    .eq('stripe_checkout_session_id', session.id)
    .maybeSingle();
  if (existing) return existing.id;

  const checkoutId = session.metadata?.checkout_id ?? session.client_reference_id;
  const { data: checkout } = await db
    .from('checkouts')
    .select('id, cart_id, snapshot')
    .eq('id', checkoutId)
    .maybeSingle();
  if (!checkout) {
    console.error('[orders] no checkout snapshot for session', session.id);
    return null;
  }
  const snap = checkout.snapshot as CheckoutSnapshot;

  // --- Customer (upsert by email) -------------------------------------------
  const details = session.customer_details;
  const email = details?.email?.toLowerCase() ?? null;
  // API versions differ on where shipping lives; support both.
  const s = session as unknown as {
    shipping_details?: { name?: string | null; address?: Stripe.Address | null } | null;
    collected_information?: { shipping_details?: { name?: string | null; address?: Stripe.Address | null } | null } | null;
  };
  const ship = s.collected_information?.shipping_details ?? s.shipping_details ?? null;
  const shippingAddress = toAddress(ship?.address, ship?.name ?? details?.name, details?.phone);
  const billingAddress = toAddress(details?.address, details?.name, details?.phone);

  let customerId: string | null = null;
  if (email) {
    const [first, ...rest] = (details?.name ?? '').trim().split(/\s+/);
    const { data: found } = await db.from('customers').select('id').eq('email', email).maybeSingle();
    if (found) {
      customerId = found.id;
      await db
        .from('customers')
        .update({ default_address: shippingAddress, ...(details?.phone ? { phone: details.phone } : {}) })
        .eq('id', found.id);
    } else {
      const { data: created } = await db
        .from('customers')
        .insert({
          email,
          first_name: first || null,
          last_name: rest.join(' ') || null,
          phone: details?.phone ?? null,
          default_address: shippingAddress
        })
        .select('id')
        .single();
      customerId = created?.id ?? null;
    }
  }

  const total = fromCents(session.amount_total);
  const paymentIntentId =
    typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null;

  const { data: order, error } = await db
    .from('orders')
    .insert({
      customer_id: customerId,
      cart_id: checkout.cart_id,
      email,
      phone: details?.phone ?? null,
      financial_status: session.payment_status === 'paid' ? 'paid' : 'pending',
      currency: (session.currency ?? snap.currency).toUpperCase(),
      subtotal: snap.subtotal,
      discount_total: fromCents(session.total_details?.amount_discount),
      shipping_total: fromCents(session.total_details?.amount_shipping),
      tax_total: fromCents(session.total_details?.amount_tax),
      total,
      discount_code: snap.discount?.code ?? null,
      shipping_address: shippingAddress,
      billing_address: billingAddress,
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: paymentIntentId
    })
    .select('id, order_number')
    .single();

  if (error) {
    // 23505 = unique violation → a concurrent delivery already created it.
    if (error.code === '23505') return null;
    throw new Error(`[orders] insert failed: ${error.message}`);
  }

  await db.from('order_line_items').insert(
    snap.lines.map((l) => ({
      order_id: order.id,
      product_id: l.product_id,
      variant_id: l.variant_id,
      title: l.title,
      variant_title: l.variant_title,
      sku: l.sku,
      image_url: l.image_url,
      quantity: l.quantity,
      price: l.price,
      attributes: l.attributes
    }))
  );

  const currency = (session.currency ?? snap.currency).toUpperCase();
  await db.from('order_events').insert([
    { order_id: order.id, message: `Order #${order.order_number} was placed through the online store.` },
    ...(session.payment_status === 'paid'
      ? [{ order_id: order.id, message: `A ${currency} ${total.toFixed(2)} payment was processed via Stripe.` }]
      : [])
  ]);

  if (session.payment_status === 'paid') {
    await db.rpc('apply_order_inventory', { p_order_id: order.id });
  }

  // First step of the customer-facing tracking timeline (table from migration 0004).
  const { error: trackingError } = await db
    .from('order_tracking_events')
    .insert({ order_id: order.id, status: 'confirmed', message: 'Order received.' });
  if (trackingError) console.warn('[orders] tracking event:', trackingError.message);

  if (checkout.cart_id) {
    await db.from('carts').update({ status: 'completed' }).eq('id', checkout.cart_id);
  }

  return order.id;
}

/** Async payment methods (e.g. bank debits) settle later. */
export async function markSessionPaid(session: Stripe.Checkout.Session) {
  const db = createServiceClient();
  const { data: order } = await db
    .from('orders')
    .select('id, financial_status, total, currency')
    .eq('stripe_checkout_session_id', session.id)
    .maybeSingle();
  if (!order) {
    await createOrderFromSession(session);
    return;
  }
  if (order.financial_status === 'paid') return;
  await db.from('orders').update({ financial_status: 'paid' }).eq('id', order.id);
  await db.rpc('apply_order_inventory', { p_order_id: order.id });
  await db.from('order_events').insert({
    order_id: order.id,
    message: `A ${order.currency} ${Number(order.total).toFixed(2)} payment was processed via Stripe.`
  });
}

/** Keeps refunds made in the Stripe dashboard in sync with the order. */
export async function syncRefund(charge: Stripe.Charge) {
  const paymentIntentId =
    typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
  if (!paymentIntentId) return;

  const db = createServiceClient();
  const { data: order } = await db
    .from('orders')
    .select('id, total, refunded_total, currency')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .maybeSingle();
  if (!order) return;

  const refunded = fromCents(charge.amount_refunded);
  if (refunded === Number(order.refunded_total)) return;

  await db
    .from('orders')
    .update({
      refunded_total: refunded,
      financial_status: refunded >= Number(order.total) ? 'refunded' : 'partially_refunded'
    })
    .eq('id', order.id);
  await db.from('order_events').insert({
    order_id: order.id,
    message: `Refund recorded: ${order.currency} ${(refunded - Number(order.refunded_total)).toFixed(2)}.`
  });
}
