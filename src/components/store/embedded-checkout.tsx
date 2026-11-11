'use client';

import { EmbeddedCheckout, EmbeddedCheckoutProvider } from '@stripe/react-stripe-js';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { useMemo } from 'react';

/** One Stripe.js load per publishable key, shared across renders. */
const cache = new Map<string, Promise<Stripe | null>>();
function stripeFor(key: string) {
  if (!cache.has(key)) cache.set(key, loadStripe(key));
  return cache.get(key)!;
}

/**
 * Stripe's payment form, rendered inside our own checkout page so the shopper
 * never leaves the store. Stripe serves the fields in an iframe, which is what
 * keeps card numbers out of our code.
 */
export function EmbeddedCheckoutForm({ clientSecret, publishableKey }: { clientSecret: string; publishableKey: string }) {
  const stripe = useMemo(() => stripeFor(publishableKey), [publishableKey]);
  return (
    <EmbeddedCheckoutProvider stripe={stripe} options={{ clientSecret }}>
      <EmbeddedCheckout className="min-h-[600px]" />
    </EmbeddedCheckoutProvider>
  );
}
