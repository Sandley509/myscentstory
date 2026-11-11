/**
 * Shipment statuses and carriers, shared by the admin, the /track page and emails.
 */
import { SITE } from './site';

export const SHIPMENT_STATUSES = [
  'confirmed',
  'processing',
  'shipped',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'exception'
] as const;
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

export const STATUS_INFO: Record<ShipmentStatus, { label: string; customer: string; email: boolean }> = {
  confirmed: { label: 'Order confirmed', customer: 'We’ve received your order and payment.', email: false },
  processing: { label: 'Preparing your order', customer: 'Your perfume is being checked and carefully packed.', email: false },
  shipped: { label: 'Shipped', customer: 'Your order has left our hands and is on its way.', email: true },
  in_transit: { label: 'In transit', customer: 'Your parcel is moving through the carrier’s network.', email: false },
  out_for_delivery: { label: 'Out for delivery', customer: 'Your parcel is out for delivery today.', email: true },
  delivered: { label: 'Delivered', customer: 'Your order has been delivered. Enjoy your new scent!', email: true },
  exception: {
    label: 'Delivery issue',
    customer: 'There’s a problem with the delivery. We’re on it and will contact you if we need anything.',
    email: true
  }
};

/** The progress bar on the tracking page (in transit counts as shipped; issues show separately). */
export const PROGRESS_STEPS: ShipmentStatus[] = ['confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered'];

export function progressIndex(status: ShipmentStatus): number {
  if (status === 'in_transit') return PROGRESS_STEPS.indexOf('shipped');
  if (status === 'exception') return PROGRESS_STEPS.indexOf('shipped');
  return PROGRESS_STEPS.indexOf(status);
}

export const isShipmentStatus = (v: unknown): v is ShipmentStatus =>
  typeof v === 'string' && (SHIPMENT_STATUSES as readonly string[]).includes(v);

/** `{n}` is replaced by the tracking number. */
export const CARRIERS: { id: string; name: string; url: string }[] = [
  { id: 'canada_post', name: 'Canada Post', url: 'https://www.canadapost-postescanada.ca/track-reperage/en#/details/{n}' },
  { id: 'purolator', name: 'Purolator', url: 'https://www.purolator.com/en/shipping/tracker?pin={n}' },
  { id: 'ups', name: 'UPS', url: 'https://www.ups.com/track?tracknum={n}' },
  { id: 'fedex', name: 'FedEx', url: 'https://www.fedex.com/fedextrack/?trknbr={n}' },
  { id: 'dhl', name: 'DHL Express', url: 'https://www.dhl.com/global-en/home/tracking/tracking-express.html?submit=1&tracking-id={n}' },
  { id: 'usps', name: 'USPS', url: 'https://tools.usps.com/go/TrackConfirmAction?tLabels={n}' },
  { id: 'chitchats', name: 'Chit Chats', url: 'https://chitchats.com/tracking/{n}' },
  { id: 'other', name: 'Other (17TRACK)', url: 'https://t.17track.net/en#nums={n}' }
];

export const carrierName = (id: string | null | undefined) => CARRIERS.find((c) => c.id === id)?.name ?? id ?? null;

export function trackingUrlFor(carrierId: string | null | undefined, number: string | null | undefined): string | null {
  const n = number?.trim();
  if (!n) return null;
  const c = CARRIERS.find((x) => x.id === carrierId) ?? CARRIERS.find((x) => x.id === 'other')!;
  return c.url.replace('{n}', encodeURIComponent(n));
}

/** Delivery window shown before a carrier estimate exists: order date + 8 to 15 days. */
export function estimatedWindow(orderedAt: string, handling: [number, number], transit: [number, number]) {
  const day = 86_400_000;
  const start = new Date(new Date(orderedAt).getTime() + (handling[0] + transit[0]) * day);
  const end = new Date(new Date(orderedAt).getTime() + (handling[1] + transit[1]) * day);
  return { start, end };
}

/** A day in the store's time zone. Plain dates ("2026-11-20", e.g. a delivery estimate) are shown as typed. */
export const formatDay = (d: Date | string) =>
  new Date(d).toLocaleDateString('en-CA', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
    timeZone: typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? 'UTC' : SITE.timeZone
  });

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: SITE.timeZone });
