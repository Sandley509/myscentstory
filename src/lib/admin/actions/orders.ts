'use server';

import { action, requireStaff } from '@/lib/admin/auth';
import { sendOrderConfirmation, sendTrackingEmail } from '@/lib/commerce/notifications';
import { getStripe } from '@/lib/stripe';
import { isShipmentStatus, STATUS_INFO, trackingUrlFor, type ShipmentStatus } from '@/lib/tracking';
import { revalidatePath } from 'next/cache';

const refresh = (id: string) => {
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath('/admin/orders');
  revalidatePath('/admin', 'layout');
};

async function logEvent(db: Awaited<ReturnType<typeof requireStaff>>['supabase'], orderId: string, message: string, author?: string, kind: 'system' | 'comment' = 'system') {
  await db.from('order_events').insert({ order_id: orderId, message, author: author ?? null, kind });
}

/**
 * Records a customer-visible shipment update and, if asked, emails it.
 * Returns the email problem (if any) so the admin can see it without the
 * update itself failing.
 */
async function recordShipmentUpdate(
  db: Awaited<ReturnType<typeof requireStaff>>['supabase'],
  orderId: string,
  input: { status: ShipmentStatus; message?: string; location?: string; notify?: boolean },
  author: string
): Promise<string | null> {
  const { data: event, error } = await db
    .from('order_tracking_events')
    .insert({
      order_id: orderId,
      status: input.status,
      message: input.message?.trim().slice(0, 500) || null,
      location: input.location?.trim().slice(0, 120) || null
    })
    .select('id')
    .single();
  if (error) {
    throw new Error(
      /order_tracking_events/.test(error.message) ? 'Run supabase/migrations/0004_tracking_emails_offers.sql in Supabase first.' : error.message
    );
  }
  await db.from('orders').update({ shipment_status: input.status }).eq('id', orderId);
  await logEvent(db, orderId, `${author} set the shipment status to “${STATUS_INFO[input.status].label}”${input.location ? ` (${input.location.trim()})` : ''}.`);
  if (!input.notify) return null;
  const res = await sendTrackingEmail(orderId, event.id as string);
  return res.ok ? null : res.error;
}

export async function fulfillOrder(
  orderId: string,
  input: { tracking_number?: string; tracking_url?: string; carrier?: string; notify?: boolean }
) {
  return action(async () => {
    const { supabase: db, staff } = await requireStaff();
    const { data: items } = await db.from('order_line_items').select('id, quantity').eq('order_id', orderId);
    for (const li of items ?? []) {
      await db.from('order_line_items').update({ fulfilled_quantity: li.quantity }).eq('id', li.id);
    }
    const number = input.tracking_number?.trim() || null;
    const manualUrl = input.tracking_url?.trim();
    const carrier = input.carrier?.trim() || null;
    const { error } = await db
      .from('orders')
      .update({
        fulfillment_status: 'fulfilled',
        fulfilled_at: new Date().toISOString(),
        tracking_number: number,
        carrier,
        tracking_url: manualUrl && /^https?:\/\//i.test(manualUrl) ? manualUrl : trackingUrlFor(carrier, number)
      })
      .eq('id', orderId);
    if (error) throw new Error(error.message);
    const author = staff.name || staff.email;
    await logEvent(
      db,
      orderId,
      `${author} fulfilled ${(items ?? []).reduce((s, i) => s + i.quantity, 0)} item(s)${number ? ` · Tracking ${number}` : ''}.`
    );
    const emailProblem = await recordShipmentUpdate(db, orderId, { status: 'shipped', notify: input.notify ?? true }, author);
    refresh(orderId);
    return { emailProblem };
  });
}

/** Carrier, tracking number and delivery estimate, editable at any time. */
export async function saveShipmentDetails(
  orderId: string,
  input: { carrier: string; tracking_number: string; tracking_url: string; estimated_delivery: string }
) {
  return action(async () => {
    const { supabase: db } = await requireStaff();
    const number = input.tracking_number.trim() || null;
    const carrier = input.carrier.trim() || null;
    const manualUrl = input.tracking_url.trim();
    if (manualUrl && !/^https?:\/\//i.test(manualUrl)) throw new Error('The tracking link must start with https://');
    const eta = input.estimated_delivery.trim();
    if (eta && !/^\d{4}-\d{2}-\d{2}$/.test(eta)) throw new Error('Choose a valid delivery date.');
    const { error } = await db
      .from('orders')
      .update({
        carrier,
        tracking_number: number,
        tracking_url: manualUrl || trackingUrlFor(carrier, number),
        estimated_delivery: eta || null
      })
      .eq('id', orderId);
    if (error) throw new Error(/carrier|estimated_delivery/.test(error.message) ? 'Run supabase/migrations/0004_tracking_emails_offers.sql in Supabase first.' : error.message);
    refresh(orderId);
  });
}

export async function addTrackingUpdate(
  orderId: string,
  input: { status: string; message: string; location: string; notify: boolean }
) {
  return action(async () => {
    const { supabase: db, staff } = await requireStaff();
    if (!isShipmentStatus(input.status)) throw new Error('Choose a status.');
    const emailProblem = await recordShipmentUpdate(db, orderId, { ...input, status: input.status }, staff.name || staff.email);
    if (input.status === 'delivered') {
      await db.from('orders').update({ fulfillment_status: 'fulfilled' }).eq('id', orderId).neq('fulfillment_status', 'fulfilled');
    }
    refresh(orderId);
    return { emailProblem };
  });
}

export async function resendConfirmation(orderId: string) {
  return action(async () => {
    await requireStaff();
    const res = await sendOrderConfirmation(orderId, { force: true });
    if (!res.ok) throw new Error(res.error);
    refresh(orderId);
  });
}

export async function unfulfillOrder(orderId: string) {
  return action(async () => {
    const { supabase: db, staff } = await requireStaff();
    await db.from('order_line_items').update({ fulfilled_quantity: 0 }).eq('order_id', orderId);
    const { error } = await db
      .from('orders')
      .update({ fulfillment_status: 'unfulfilled', fulfilled_at: null })
      .eq('id', orderId);
    if (error) throw new Error(error.message);
    await logEvent(db, orderId, `${staff.name || staff.email} canceled the fulfillment.`);
    refresh(orderId);
  });
}

export async function addOrderComment(orderId: string, message: string) {
  return action(async () => {
    const { supabase: db, staff } = await requireStaff();
    const text = message.trim().slice(0, 5000);
    if (!text) throw new Error('Comment can’t be blank.');
    await logEvent(db, orderId, text, staff.name || staff.email, 'comment');
    refresh(orderId);
  });
}

export async function updateOrderNote(orderId: string, note: string) {
  return action(async () => {
    const { supabase: db } = await requireStaff();
    const { error } = await db.from('orders').update({ note: note.trim() || null }).eq('id', orderId);
    if (error) throw new Error(error.message);
    refresh(orderId);
  });
}

export async function setOrderArchived(orderId: string, archived: boolean) {
  return action(async () => {
    const { supabase: db, staff } = await requireStaff();
    const { error } = await db.from('orders').update({ status: archived ? 'archived' : 'open' }).eq('id', orderId);
    if (error) throw new Error(error.message);
    await logEvent(db, orderId, `${staff.name || staff.email} ${archived ? 'archived' : 'unarchived'} this order.`);
    refresh(orderId);
  });
}

export async function markOrderPaid(orderId: string) {
  return action(async () => {
    const { supabase: db, staff } = await requireStaff();
    const { data: order } = await db.from('orders').select('financial_status').eq('id', orderId).single();
    if (order?.financial_status !== 'pending') throw new Error('Only pending orders can be marked as paid.');
    await db.from('orders').update({ financial_status: 'paid' }).eq('id', orderId);
    await logEvent(db, orderId, `${staff.name || staff.email} manually marked this order as paid.`);
    refresh(orderId);
  });
}

/** Refund through Stripe (full or partial). The webhook also syncs this. */
export async function refundOrder(orderId: string, amount: number, reason: string, restock: boolean) {
  return action(async () => {
    const { supabase: db, staff } = await requireStaff();
    const { data: order, error } = await db
      .from('orders')
      .select('id, total, refunded_total, currency, stripe_payment_intent_id, financial_status')
      .eq('id', orderId)
      .single();
    if (error || !order) throw new Error('Order not found.');

    const refundable = Math.round((Number(order.total) - Number(order.refunded_total)) * 100) / 100;
    const amt = Math.round(Number(amount) * 100) / 100;
    if (!(amt > 0)) throw new Error('Enter an amount to refund.');
    if (amt > refundable) throw new Error(`You can refund up to ${refundable.toFixed(2)}.`);
    if (!order.stripe_payment_intent_id) throw new Error('This order has no Stripe payment to refund.');

    await getStripe().refunds.create({
      payment_intent: order.stripe_payment_intent_id,
      amount: Math.round(amt * 100),
      metadata: { order_id: orderId, reason: reason.slice(0, 200) }
    });

    const newRefunded = Math.round((Number(order.refunded_total) + amt) * 100) / 100;
    await db
      .from('orders')
      .update({
        refunded_total: newRefunded,
        financial_status: newRefunded >= Number(order.total) ? 'refunded' : 'partially_refunded'
      })
      .eq('id', orderId);

    if (restock) {
      const { data: items } = await db.from('order_line_items').select('variant_id, quantity').eq('order_id', orderId);
      for (const li of items ?? []) {
        if (!li.variant_id) continue;
        const { data: v } = await db
          .from('product_variants')
          .select('inventory_quantity, track_inventory')
          .eq('id', li.variant_id)
          .maybeSingle();
        if (v?.track_inventory) {
          await db.from('product_variants').update({ inventory_quantity: v.inventory_quantity + li.quantity }).eq('id', li.variant_id);
        }
      }
    }

    await logEvent(
      db,
      orderId,
      `${staff.name || staff.email} refunded ${order.currency} ${amt.toFixed(2)}${reason ? ` — ${reason}` : ''}${restock ? ' (items restocked)' : ''}.`
    );
    refresh(orderId);
  });
}

export async function cancelOrder(orderId: string, opts: { restock: boolean; refund: boolean; reason: string }) {
  return action(async () => {
    const { supabase: db, staff } = await requireStaff();
    const { data: order } = await db
      .from('orders')
      .select('total, refunded_total, financial_status, status')
      .eq('id', orderId)
      .single();
    if (!order) throw new Error('Order not found.');
    if (order.status === 'cancelled') throw new Error('This order is already canceled.');

    if (opts.refund && order.financial_status !== 'refunded' && order.financial_status !== 'pending') {
      const remaining = Number(order.total) - Number(order.refunded_total);
      if (remaining > 0) {
        const res = await refundOrder(orderId, remaining, opts.reason || 'Order canceled', opts.restock);
        if (!res.ok) throw new Error(res.error);
      }
    } else if (opts.restock) {
      const { data: items } = await db.from('order_line_items').select('variant_id, quantity').eq('order_id', orderId);
      for (const li of items ?? []) {
        if (!li.variant_id) continue;
        const { data: v } = await db.from('product_variants').select('inventory_quantity, track_inventory').eq('id', li.variant_id).maybeSingle();
        if (v?.track_inventory) {
          await db.from('product_variants').update({ inventory_quantity: v.inventory_quantity + li.quantity }).eq('id', li.variant_id);
        }
      }
    }

    await db
      .from('orders')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        ...(order.financial_status === 'pending' ? { financial_status: 'voided' } : {})
      })
      .eq('id', orderId);
    await logEvent(db, orderId, `${staff.name || staff.email} canceled this order${opts.reason ? ` — ${opts.reason}` : ''}.`);
    refresh(orderId);
  });
}
