import 'server-only';

import { supabaseConfigured } from '@/lib/supabase/env';
import { createServiceClient } from '@/lib/supabase/server';
import type { Address, OrderLineItemRow, OrderRow, TrackingEventRow } from './db';
import { orderToken, verifyOrderToken } from './order-link';

export type TrackedOrder = {
  id: string;
  number: number;
  placedAt: string;
  status: NonNullable<OrderRow['shipment_status']>;
  cancelled: boolean;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  estimatedDelivery: string | null;
  /** City and country only: the page never shows a full address. */
  destination: string | null;
  items: { title: string; variant: string | null; quantity: number; image: string | null }[];
  events: { status: TrackingEventRow['status']; message: string | null; location: string | null; at: string }[];
};

const ORDER_FIELDS = 'id, order_number, email, created_at, status, shipment_status, carrier, tracking_number, tracking_url, estimated_delivery, shipping_address';

/** Finds an order by number + email; returns the signed URL of its tracking page. */
export async function findOrderLink(orderNumber: string, email: string): Promise<string | null> {
  if (!supabaseConfigured) return null;
  const n = Number(String(orderNumber).replace(/[^\d]/g, ''));
  const address = email.trim().toLowerCase();
  if (!Number.isInteger(n) || n <= 0 || n > 2_000_000_000 || !address.includes('@')) return null;
  const { data } = await createServiceClient().from('orders').select('id, order_number, email').eq('order_number', n).maybeSingle();
  if (!data || (data.email ?? '').toLowerCase() !== address) return null;
  return `/track?order=${data.order_number}&t=${orderToken(data.id as string)}`;
}

/** Loads the tracking view for a signed link; null when the link is wrong. */
export async function loadTrackedOrder(orderNumber: string | undefined, token: string | undefined): Promise<TrackedOrder | null> {
  if (!supabaseConfigured || !orderNumber || !token) return null;
  const n = Number(orderNumber);
  if (!Number.isInteger(n) || n <= 0) return null;
  const db = createServiceClient();
  const { data: order } = await db.from('orders').select(ORDER_FIELDS).eq('order_number', n).maybeSingle();
  if (!order || !verifyOrderToken(order.id as string, token)) return null;

  const [{ data: items }, { data: events }] = await Promise.all([
    db.from('order_line_items').select('title, variant_title, quantity, image_url').eq('order_id', order.id),
    db.from('order_tracking_events').select('status, message, location, created_at').eq('order_id', order.id).order('created_at', { ascending: false })
  ]);
  const ship = order.shipping_address as Address | null;
  const destination = [ship?.city, ship?.country].filter(Boolean).join(', ') || null;

  return {
    id: order.id as string,
    number: order.order_number as number,
    placedAt: order.created_at as string,
    status: (order.shipment_status as TrackedOrder['status']) ?? 'confirmed',
    cancelled: order.status === 'cancelled',
    carrier: (order.carrier as string | null) ?? null,
    trackingNumber: (order.tracking_number as string | null) ?? null,
    trackingUrl: (order.tracking_url as string | null) ?? null,
    estimatedDelivery: (order.estimated_delivery as string | null) ?? null,
    destination,
    items: ((items ?? []) as Pick<OrderLineItemRow, 'title' | 'variant_title' | 'quantity' | 'image_url'>[]).map((i) => ({
      title: i.title,
      variant: i.variant_title,
      quantity: i.quantity,
      image: i.image_url
    })),
    events: ((events ?? []) as Pick<TrackingEventRow, 'status' | 'message' | 'location' | 'created_at'>[]).map((e) => ({
      status: e.status,
      message: e.message,
      location: e.location,
      at: e.created_at
    }))
  };
}
