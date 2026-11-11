import 'server-only';

import Stripe from 'stripe';

let stripe: Stripe | null = null;

/** Server-side Stripe client. Uses the SDK's pinned API version. */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not set. Add it to .env and restart.');
  }
  if (!stripe) stripe = new Stripe(key);
  return stripe;
}

export const stripeConfigured = () => Boolean(process.env.STRIPE_SECRET_KEY);
