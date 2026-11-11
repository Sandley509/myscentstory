import 'server-only';

import { sendEmail } from '@/lib/email';
import { orderConfirmationEmail, shippingUpdateEmail } from '@/lib/email-templates';
import { SITE } from '@/lib/site';
import { createServiceClient } from '@/lib/supabase/server';
import type { OrderLineItemRow, OrderRow, TrackingEventRow } from './db';
import { getStoreSettings } from './index';
import { trackingLink } from './order-link';

type Result = { ok: true } | { ok: false; error: string };

async function load(orderId: string) {
  const db = createServiceClient();
  const [{ data: order }, { data: items }, settings] = await Promise.all([
    db.from('orders').select('*').eq('id', orderId).maybeSingle(),
    db.from('order_line_items').select('*').eq('order_id', orderId),
    getStoreSettings()
  ]);
  return {
    db,
    order: order as OrderRow | null,
    items: (items ?? []) as OrderLineItemRow[],
    base: {
      storeName: settings.store_name || SITE.name,
      supportEmail: settings.contact_email || SITE.supportEmail
    }
  };
}

/**
 * Sends the order confirmation once. Safe to call from every webhook delivery:
 * it only sends for a paid order that hasn't had one yet. `force` resends
 * (the admin "Resend confirmation" button).
 */
export async function sendOrderConfirmation(orderId: string, { force = false } = {}): Promise<Result> {
  const { db, order, items, base } = await load(orderId);
  if (!order) return { ok: false, error: 'Order not found.' };
  if (!order.email) return { ok: false, error: 'This order has no email address.' };
  if (!force && (order.confirmation_email_sent_at || order.financial_status !== 'paid')) return { ok: true };

  if (!force) {
    // Claim the send first, so two webhook deliveries arriving together can't both email.
    const { data: claimed } = await db
      .from('orders')
      .update({ confirmation_email_sent_at: new Date().toISOString() })
      .eq('id', orderId)
      .is('confirmation_email_sent_at', null)
      .select('id');
    if (!claimed?.length) return { ok: true };
  }

  const email = orderConfirmationEmail({ ...base, trackUrl: trackingLink(order) }, order, items);
  const res = await sendEmail({ to: order.email, replyTo: base.supportEmail, ...email });
  if (!res.ok) {
    if (!force) await db.from('orders').update({ confirmation_email_sent_at: null }).eq('id', orderId);
    await db.from('order_events').insert({ order_id: orderId, message: `Order confirmation email not sent: ${res.error}` });
    return res;
  }
  if (force) await db.from('orders').update({ confirmation_email_sent_at: new Date().toISOString() }).eq('id', orderId);
  await db.from('order_events').insert({ order_id: orderId, message: `Order confirmation email sent to ${order.email}.` });
  return { ok: true };
}

/** Emails the customer about one tracking update. */
export async function sendTrackingEmail(orderId: string, eventId: string): Promise<Result> {
  const { db, order, items, base } = await load(orderId);
  if (!order) return { ok: false, error: 'Order not found.' };
  if (!order.email) return { ok: false, error: 'This order has no email address.' };
  const { data: event } = await db.from('order_tracking_events').select('*').eq('id', eventId).maybeSingle();
  if (!event) return { ok: false, error: 'Update not found.' };

  const email = shippingUpdateEmail({ ...base, trackUrl: trackingLink(order) }, order, event as TrackingEventRow, items);
  const res = await sendEmail({ to: order.email, replyTo: base.supportEmail, ...email });
  if (!res.ok) {
    await db.from('order_events').insert({ order_id: orderId, message: `Shipping email not sent: ${res.error}` });
    return res;
  }
  await db.from('order_tracking_events').update({ emailed_at: new Date().toISOString() }).eq('id', eventId);
  await db.from('order_events').insert({ order_id: orderId, message: `Shipping update “${email.subject}” emailed to ${order.email}.` });
  return { ok: true };
}
