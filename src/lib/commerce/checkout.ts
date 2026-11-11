import 'server-only';

import { checkoutCountries } from '@/lib/countries';
import { SITE } from '@/lib/site';
import { createServiceClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/stripe';
import { headers } from 'next/headers';
import type Stripe from 'stripe';
import type { CheckoutSnapshot, VariantRow } from './db';
import { checkCustomerDiscount, findDiscount, getCartForCheckout, getStoreSettings } from './index';
import { evaluateDiscount, round2, shippingFor, toCents, toNumber } from './pricing';

export type StartCheckoutResult =
  /** Stripe's own hosted page; the shopper is sent to `url`. */
  | { ok: true; mode: 'hosted'; url: string }
  /** Stripe's form shown inside our own /checkout page. */
  | { ok: true; mode: 'embedded'; clientSecret: string }
  | { ok: false; error: string };

/** Absolute origin of the current request (works behind Vercel/proxies). */
export async function getOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto = h.get('x-forwarded-proto') ?? (host?.startsWith('localhost') ? 'http' : 'https');
  if (host) return `${proto}://${host}`;
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
}

/**
 * Freezes the current cart into a `checkouts` snapshot and creates a Stripe
 * Checkout Session for it. Prices, stock and discounts are re-validated here —
 * nothing from the browser is trusted.
 */
export async function startCheckout(opts: { embedded?: boolean } = {}): Promise<StartCheckoutResult> {
  const loaded = await getCartForCheckout();
  if (!loaded || !loaded.cart.lines.length) {
    return { ok: false, error: 'Your cart is empty.' };
  }

  const { row, cart } = loaded;
  const settings = await getStoreSettings();
  const currency = settings.currency.toLowerCase();

  // --- Build the snapshot from DB rows, re-checking stock -------------------
  const lines: CheckoutSnapshot['lines'] = [];
  for (const l of row.cart_lines) {
    const v = l.product_variants as (VariantRow & { products: { id: string; title: string; status: string; product_images: { url: string; position: number }[] } | null }) | null;
    const p = v?.products;
    if (!v || !p || p.status !== 'active') {
      return { ok: false, error: 'An item in your cart is no longer available. Please remove it and try again.' };
    }
    if (v.track_inventory && !v.continue_selling && l.quantity > v.inventory_quantity) {
      return {
        ok: false,
        error: `Only ${Math.max(v.inventory_quantity, 0)} of “${p.title}” left in stock. Please update your cart.`
      };
    }
    const image = [...(p.product_images ?? [])].sort((a, b) => a.position - b.position)[0]?.url ?? null;
    lines.push({
      product_id: p.id,
      variant_id: v.id,
      title: p.title,
      variant_title: v.title && v.title !== 'Default Title' ? v.title : null,
      sku: v.sku,
      image_url: image,
      quantity: l.quantity,
      price: round2(toNumber(v.price)),
      attributes: (l.attributes ?? []).map((a) => ({ key: a.key, value: a.value }))
    });
  }

  const subtotal = round2(lines.reduce((s, l) => s + l.price * l.quantity, 0));

  // --- Discount --------------------------------------------------------------
  let discount: CheckoutSnapshot['discount'] = null;
  let freeShipping = false;
  if (row.discount_code) {
    const d = await findDiscount(row.discount_code);
    const evaluation = evaluateDiscount(d, subtotal);
    // First-order / once-per-customer codes are re-checked against the email
    // the shopper gave; Stripe Checkout is then locked to that email.
    const customerProblem = evaluation.ok && d ? await checkCustomerDiscount(d, row.email) : null;
    if (customerProblem) return { ok: false, error: `${customerProblem} Remove the code to continue.` };
    if (evaluation.ok && d) {
      discount = { code: d.code.toUpperCase(), type: d.type, amount: evaluation.amount };
      freeShipping = evaluation.freeShipping;
    }
  }

  const shipping = shippingFor(settings, subtotal - (discount?.amount ?? 0), freeShipping);

  const snapshot: CheckoutSnapshot = { currency: settings.currency, subtotal, discount, shipping, lines };

  // --- Stripe session --------------------------------------------------------
  const stripe = getStripe();
  const origin = await getOrigin();

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = lines.map((l) => {
    const details = [l.variant_title, ...l.attributes.map((a) => `${a.key}: ${a.value}`)]
      .filter(Boolean)
      .join(' · ')
      .slice(0, 500);
    return {
      quantity: l.quantity,
      price_data: {
        currency,
        unit_amount: toCents(l.price),
        product_data: {
          name: l.title,
          ...(details ? { description: details } : {}),
          ...(l.image_url?.startsWith('https://') ? { images: [l.image_url] } : {})
        }
      }
    };
  });

  let couponId: string | undefined;
  if (discount && discount.amount > 0) {
    const coupon = await stripe.coupons.create({
      amount_off: toCents(discount.amount),
      currency,
      duration: 'once',
      max_redemptions: 1,
      name: discount.code
    });
    couponId = coupon.id;
  }

  const db = createServiceClient();
  const { data: checkout, error } = await db
    .from('checkouts')
    .insert({ cart_id: cart.id, snapshot })
    .select('id')
    .single();
  if (error) {
    console.error('[checkout] snapshot insert failed:', error.message);
    return { ok: false, error: 'Checkout is unavailable right now. Please try again.' };
  }

  const countries = checkoutCountries(settings) as Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[];

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: lineItems,
    ...(couponId ? { discounts: [{ coupon: couponId }] } : {}),
    shipping_address_collection: { allowed_countries: countries },
    shipping_options: [
      {
        shipping_rate_data: {
          type: 'fixed_amount',
          display_name: shipping === 0 ? 'Free shipping' : 'Standard shipping',
          fixed_amount: { amount: toCents(shipping), currency },
          delivery_estimate: {
            minimum: { unit: 'business_day', value: SITE.shipping.handlingDays[0] + SITE.shipping.transitDays[0] },
            maximum: { unit: 'business_day', value: SITE.shipping.handlingDays[1] + SITE.shipping.transitDays[1] }
          }
        }
      }
    ],
    phone_number_collection: { enabled: true },
    ...(row.email ? { customer_email: row.email } : {}),
    automatic_tax: { enabled: settings.stripe_automatic_tax },
    billing_address_collection: 'auto',
    client_reference_id: checkout.id,
    metadata: { checkout_id: checkout.id, cart_id: cart.id ?? '' },
    payment_intent_data: { metadata: { checkout_id: checkout.id } },
    // Unpaid sessions expire after an hour (Stripe's minimum is 30 minutes), so an
    // abandoned checkout shows up in /admin → Abandoned carts with its email soon.
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
    ...(opts.embedded
      ? {
          ui_mode: 'embedded_page' as const,
          // Embedded checkout has no cancel URL: the shopper simply leaves the page.
          return_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`
        }
      : {
          success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${origin}/?checkout=cancelled`
        })
  });

  await db.from('checkouts').update({ stripe_session_id: session.id }).eq('id', checkout.id);

  if (opts.embedded) {
    if (!session.client_secret) return { ok: false, error: 'Checkout is unavailable right now.' };
    return { ok: true, mode: 'embedded', clientSecret: session.client_secret };
  }
  if (!session.url) return { ok: false, error: 'Checkout is unavailable right now.' };
  return { ok: true, mode: 'hosted', url: session.url };
}
