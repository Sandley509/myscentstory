import 'server-only';

import Stripe from 'stripe';

let stripe: Stripe | null = null;

/** Server-side Stripe client. Uses the SDK's pinned API version. */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not set. Add it to .env and restart.');
  }
  if (!stripe) {
    // STRIPE_API_HOST only exists so the checkout flow can be exercised against
    // a local stand-in during testing; unset in normal use, as it should be.
    const host = process.env.STRIPE_API_HOST;
    stripe = host
      ? new Stripe(key, { host: host.split(':')[0], port: Number(host.split(':')[1] ?? 80), protocol: 'http' })
      : new Stripe(key);
  }
  return stripe;
}

export const stripeConfigured = () => Boolean(process.env.STRIPE_SECRET_KEY);
