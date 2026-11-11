/**
 * Ecommerce events for Google (GA4 + Google Ads) and the Meta Pixel.
 *
 * Safe to call anywhere on the client: when a tag isn't loaded — no ID
 * configured, or the visitor declined cookies — the call does nothing.
 * Item ids are variant ids, the same ids the product feed sends as `g:id`,
 * which is what lets Google and Meta run dynamic/catalogue ads later.
 */
export type TrackItem = {
  id: string;
  name: string;
  brand?: string | null;
  variant?: string | null;
  price: number;
  quantity: number;
};

type Tagged = Window & {
  gtag?: (...args: unknown[]) => void;
  fbq?: (...args: unknown[]) => void;
  dataLayer?: unknown[];
};

const w = () => (typeof window === 'undefined' ? undefined : (window as Tagged));

const gaItems = (items: TrackItem[]) =>
  items.map((i) => ({
    item_id: i.id,
    item_name: i.name,
    ...(i.brand ? { item_brand: i.brand } : {}),
    ...(i.variant ? { item_variant: i.variant } : {}),
    price: i.price,
    quantity: i.quantity
  }));

/**
 * Google Tag Manager reads events off the dataLayer, not from gtag(), so every
 * event is sent both ways: gtag for a GA4/Ads tag wired up directly, and a
 * dataLayer push for a GTM container. Whichever is configured picks it up.
 */
const pushDataLayer = (event: string, ecommerce: Record<string, unknown>) => {
  const dl = w()?.dataLayer;
  if (!dl) return;
  // Google's guidance: clear the previous event's object first, so values
  // from the last event can't leak into this one.
  dl.push({ ecommerce: null });
  dl.push({ event, ecommerce });
};

const total = (items: TrackItem[]) => Math.round(items.reduce((s, i) => s + i.price * i.quantity, 0) * 100) / 100;

const metaContents = (items: TrackItem[]) => ({
  content_type: 'product',
  content_ids: items.map((i) => i.id),
  contents: items.map((i) => ({ id: i.id, quantity: i.quantity }))
});

export function trackViewItem(item: TrackItem, currency: string) {
  w()?.gtag?.('event', 'view_item', { currency, value: item.price, items: gaItems([item]) });
  pushDataLayer('view_item', { currency, value: item.price, items: gaItems([item]) });
  w()?.fbq?.('track', 'ViewContent', { ...metaContents([item]), content_name: item.name, value: item.price, currency });
}

export function trackAddToCart(item: TrackItem, currency: string) {
  const value = total([item]);
  w()?.gtag?.('event', 'add_to_cart', { currency, value, items: gaItems([item]) });
  pushDataLayer('add_to_cart', { currency, value, items: gaItems([item]) });
  w()?.fbq?.('track', 'AddToCart', { ...metaContents([item]), content_name: item.name, value, currency });
}

export function trackBeginCheckout(items: TrackItem[], currency: string) {
  const value = total(items);
  w()?.gtag?.('event', 'begin_checkout', { currency, value, items: gaItems(items) });
  pushDataLayer('begin_checkout', { currency, value, items: gaItems(items) });
  w()?.fbq?.('track', 'InitiateCheckout', { ...metaContents(items), value, currency, num_items: items.length });
}

export function trackPurchase(order: {
  id: string;
  value: number;
  currency: string;
  shipping?: number;
  tax?: number;
  items: TrackItem[];
}) {
  const adsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
  const adsLabel = process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL;
  w()?.gtag?.('event', 'purchase', {
    transaction_id: order.id,
    value: order.value,
    currency: order.currency,
    shipping: order.shipping ?? 0,
    tax: order.tax ?? 0,
    items: gaItems(order.items)
  });
  pushDataLayer('purchase', {
    transaction_id: order.id,
    value: order.value,
    currency: order.currency,
    shipping: order.shipping ?? 0,
    tax: order.tax ?? 0,
    items: gaItems(order.items)
  });
  if (adsId && adsLabel) {
    w()?.gtag?.('event', 'conversion', {
      send_to: `${adsId}/${adsLabel}`,
      value: order.value,
      currency: order.currency,
      transaction_id: order.id
    });
  }
  w()?.fbq?.('track', 'Purchase', { ...metaContents(order.items), value: order.value, currency: order.currency });
}
